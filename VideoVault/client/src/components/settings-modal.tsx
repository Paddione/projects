import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettingsService } from '@/services/app-settings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AuthService } from '@/services/auth';
import { ApiClient } from '@/services/api-client';
import { VideoDatabase } from '@/services/video-database';
import {
  Settings,
  Save,
  RotateCcw,
  FileVideo,
  Keyboard,
  Monitor,
  Palette,
  ShieldAlert,
  LogIn,
  LogOut,
  Languages,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface Settings {
  // File scanning preferences
  supportedExtensions: string[];
  maxScanConcurrency: number;

  // UI preferences
  defaultSortField: 'displayName' | 'lastModified' | 'size' | 'path' | 'categoryCount';
  defaultSortDirection: 'asc' | 'desc';
  uiDensity: 'compact' | 'comfortable' | 'spacious';
  showThumbnails: boolean;
  showHoverPreviews: boolean;

  // Keyboard shortcuts
  enableKeyboardNavigation: boolean;
  enableKeyboardShortcuts: boolean;

  // Performance preferences
  enableVirtualization: boolean;
  virtualizationThreshold: number;
  thumbnailQuality: 'low' | 'medium' | 'high';
  enableSpriteThumbnails: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  supportedExtensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm', 'm4v'],
  maxScanConcurrency: 4,
  defaultSortField: 'displayName',
  defaultSortDirection: 'asc',
  uiDensity: 'comfortable',
  showThumbnails: true,
  showHoverPreviews: true,
  enableKeyboardNavigation: true,
  enableKeyboardShortcuts: true,
  enableVirtualization: true,
  virtualizationThreshold: 60,
  thumbnailQuality: 'medium',
  enableSpriteThumbnails: true,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: Settings) => void;
}

export function SettingsModal({ isOpen, onClose, onSettingsChange }: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAdmin, setIsAdmin] = useState(AuthService.cachedIsAdmin);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [isProcessingHddExt, setIsProcessingHddExt] = useState(false);

  // Load settings from server on mount
  useEffect(() => {
    void (async () => {
      try {
        const saved = await AppSettingsService.get<Settings>('vv.settings');
        if (saved && typeof saved === 'object') {
          setSettings({ ...DEFAULT_SETTINGS, ...saved });
        }
      } catch { }
    })();
    // also refresh auth state
    void AuthService.refresh();
    const unsub = AuthService.subscribe(setIsAdmin);
    return () => {
      unsub?.();
    };
  }, []);

  // Check for changes compared to server-synced baseline
  useEffect(() => {
    void (async () => {
      try {
        const saved = await AppSettingsService.get<Settings>('vv.settings');
        if (saved) {
          setHasChanges(
            JSON.stringify(settings) !== JSON.stringify({ ...DEFAULT_SETTINGS, ...saved }),
          );
          return;
        }
      } catch { }
      setHasChanges(JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS));
    })();
  }, [settings]);

  const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleExtensionsChange = (value: string) => {
    const extensions = value.split(',').map((ext) => ext.trim().toLowerCase().replace(/^\./, ''));
    handleSettingChange('supportedExtensions', extensions);
  };

  const handleSave = async () => {
    await AppSettingsService.set('vv.settings', settings);
    setHasChanges(false);
    onSettingsChange?.(settings);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  const handleCleanupMissing = async () => {
    if (!confirm('This will remove all database entries that do not have a corresponding file on disk. Continue?')) {
      return;
    }

    setIsCleaning(true);
    try {
      const result = await VideoDatabase.cleanupMissingVideos();
      alert(`Cleanup complete! Removed ${result.deletedCount} missing entries.`);
    } catch (error: any) {
      alert(`Cleanup failed: ${error.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleRescanMovies = async () => {
    setIsRescanning(true);
    try {
      const result = await ApiClient.post<{ queued: number; message: string }>('/api/processing/movies/rescan');
      alert(result.message);
    } catch (error: any) {
      alert(`Rescan failed: ${error.message}`);
    } finally {
      setIsRescanning(false);
    }
  };

  const handleIndexHddExt = async () => {
    setIsProcessingHddExt(true);
    try {
      const result = await ApiClient.post<{ indexed: number; skipped: number; errors: number; total: number }>('/api/processing/hdd-ext/index');
      alert(`HDD-ext index complete — ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors (${result.total} total)`);
    } catch (error: any) {
      alert(`HDD-ext indexing failed: ${error.message}`);
    } finally {
      setIsProcessingHddExt(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>Configure VideoVault preferences and behavior</DialogDescription>
        </DialogHeader>

        {/* Auth status */}
        <div className="mb-2 flex items-center justify-between rounded border p-3 bg-muted/40">
          <div className="flex items-center gap-2 text-sm">
            <ShieldAlert
              className={isAdmin ? 'text-green-600 h-4 w-4' : 'text-amber-600 h-4 w-4'}
            />
            <span className="text-foreground">
              {isAdmin ? 'Logged in as admin' : 'Admin features locked. Login required.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isAdmin ? (
              <button
                onClick={() => {
                  void AuthService.promptAndLogin();
                }}
                className="text-primary text-sm inline-flex items-center gap-1"
                data-testid="button-admin-login-inline"
              >
                <LogIn className="h-4 w-4" /> Login
              </button>
            ) : (
              <button
                onClick={() => {
                  void AuthService.logout();
                }}
                className="text-muted-foreground text-sm inline-flex items-center gap-1"
                data-testid="button-admin-logout-inline"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6 py-4">
          {/* File Scanning Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileVideo className="h-4 w-4 text-primary" />
              <h3 className="font-medium">File Scanning</h3>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="extensions">Supported File Extensions</Label>
                <Input
                  id="extensions"
                  value={settings.supportedExtensions.join(', ')}
                  onChange={(e) => handleExtensionsChange(e.target.value)}
                  placeholder="mp4, avi, mkv, mov, wmv, webm, m4v"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated list of video file extensions (without dots)
                </p>
              </div>

              <div>
                <Label htmlFor="concurrency">Max Scan Concurrency</Label>
                <Select
                  value={settings.maxScanConcurrency.toString()}
                  onValueChange={(value) =>
                    handleSettingChange('maxScanConcurrency', parseInt(value))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 files at once</SelectItem>
                    <SelectItem value="4">4 files at once</SelectItem>
                    <SelectItem value="8">8 files at once</SelectItem>
                    <SelectItem value="16">16 files at once</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Higher values scan faster but may impact system performance
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Language Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Language</h3>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="language">Display Language</Label>
                <Select
                  value={i18n.language}
                  onValueChange={(value) => i18n.changeLanguage(value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* UI Preferences Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Interface</h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="defaultSort">Default Sort</Label>
                  <Select
                    value={settings.defaultSortField}
                    onValueChange={(value: Settings['defaultSortField']) =>
                      handleSettingChange('defaultSortField', value)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="displayName">Name</SelectItem>
                      <SelectItem value="lastModified">Date Modified</SelectItem>
                      <SelectItem value="size">File Size</SelectItem>
                      <SelectItem value="path">Path</SelectItem>
                      <SelectItem value="categoryCount">Category Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sortDirection">Sort Direction</Label>
                  <Select
                    value={settings.defaultSortDirection}
                    onValueChange={(value: Settings['defaultSortDirection']) =>
                      handleSettingChange('defaultSortDirection', value)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="uiDensity">UI Density</Label>
                <Select
                  value={settings.uiDensity}
                  onValueChange={(value: Settings['uiDensity']) =>
                    handleSettingChange('uiDensity', value)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="spacious">Spacious</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="showThumbnails">Show Thumbnails</Label>
                  <Switch
                    id="showThumbnails"
                    checked={settings.showThumbnails}
                    onCheckedChange={(checked) => handleSettingChange('showThumbnails', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="showHoverPreviews">Show Hover Previews</Label>
                  <Switch
                    id="showHoverPreviews"
                    checked={settings.showHoverPreviews}
                    onCheckedChange={(checked) => handleSettingChange('showHoverPreviews', checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Keyboard Navigation Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Keyboard Navigation</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="enableKeyboardNav">Enable Arrow Key Navigation</Label>
                <Switch
                  id="enableKeyboardNav"
                  checked={settings.enableKeyboardNavigation}
                  onCheckedChange={(checked) =>
                    handleSettingChange('enableKeyboardNavigation', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enableShortcuts">Enable Keyboard Shortcuts</Label>
                <Switch
                  id="enableShortcuts"
                  checked={settings.enableKeyboardShortcuts}
                  onCheckedChange={(checked) =>
                    handleSettingChange('enableKeyboardShortcuts', checked)
                  }
                />
              </div>

              {settings.enableKeyboardShortcuts && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <h4 className="font-medium mb-2">Available Shortcuts:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <kbd className="bg-background px-1 py-0.5 rounded">E</kbd> Edit tags
                    </div>
                    <div>
                      <kbd className="bg-background px-1 py-0.5 rounded">R</kbd> Rename
                    </div>
                    <div>
                      <kbd className="bg-background px-1 py-0.5 rounded">M</kbd> Move
                    </div>
                    <div>
                      <kbd className="bg-background px-1 py-0.5 rounded">Delete</kbd> Delete
                    </div>
                    <div>
                      <kbd className="bg-background px-1 py-0.5 rounded">Space</kbd> Play
                    </div>
                    <div>
                      <kbd className="bg-background px-1 py-0.5 rounded">Esc</kbd> Clear focus
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Performance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Performance</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="enableVirtualization">Enable Virtualization</Label>
                <Switch
                  id="enableVirtualization"
                  checked={settings.enableVirtualization}
                  onCheckedChange={(checked) =>
                    handleSettingChange('enableVirtualization', checked)
                  }
                />
              </div>

              {settings.enableVirtualization && (
                <div>
                  <Label htmlFor="virtualizationThreshold">Virtualization Threshold</Label>
                  <Select
                    value={settings.virtualizationThreshold.toString()}
                    onValueChange={(value) =>
                      handleSettingChange('virtualizationThreshold', parseInt(value))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 videos</SelectItem>
                      <SelectItem value="60">60 videos</SelectItem>
                      <SelectItem value="100">100 videos</SelectItem>
                      <SelectItem value="200">200 videos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enable virtualization when library exceeds this number
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="thumbnailQuality">Thumbnail Quality</Label>
                <Select
                  value={settings.thumbnailQuality}
                  onValueChange={(value: Settings['thumbnailQuality']) =>
                    handleSettingChange('thumbnailQuality', value)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (faster generation)</SelectItem>
                    <SelectItem value="medium">Medium (balanced)</SelectItem>
                    <SelectItem value="high">High (slower generation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enableSpriteThumbs">Enable Sprite Thumbnails (hover preview)</Label>
                <Switch
                  id="enableSpriteThumbs"
                  checked={settings.enableSpriteThumbnails}
                  onCheckedChange={(checked) =>
                    handleSettingChange('enableSpriteThumbnails', checked)
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Disable on low-power devices to reduce CPU/memory during hover previews.
              </p>
            </div>
          </div>

          <Separator />

          {/* Maintenance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Maintenance</h3>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <Label>Database Cleanup</Label>
                <p className="text-xs text-muted-foreground">
                  Remove entries for files that no longer exist on disk. Use this if you have moved or deleted files outside of VideoVault.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCleanupMissing}
                  disabled={isCleaning || !isAdmin}
                  className="w-fit flex items-center gap-2"
                >
                  {isCleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Clear Missing Entries
                </Button>
                {!isAdmin && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Admin login required for cleanup
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Rescan Movies</Label>
                <p className="text-xs text-muted-foreground">
                  Force a fresh scan of the movies directory. Queues any files missing thumbnails for processing.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRescanMovies}
                  disabled={isRescanning}
                  className="w-fit flex items-center gap-2"
                >
                  {isRescanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Rescan Movies
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Index HDD-ext</Label>
                <p className="text-xs text-muted-foreground">
                  Index all videos on the external HDD share into the library grid. Uses existing thumbnails — no ffmpeg processing needed.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleIndexHddExt}
                  disabled={isProcessingHddExt}
                  className="w-fit flex items-center gap-2"
                >
                  {isProcessingHddExt ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Index HDD-ext
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleSave();
              }}
              disabled={!hasChanges}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
