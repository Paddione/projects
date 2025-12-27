import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/ui/theme-provider';
import {
  Video,
  Moon,
  Sun,
  FolderOpen,
  Download,
  Upload,
  Edit,
  ClipboardList,
  Shield,
  FolderPlus,
  FolderMinus,
  XCircle,
  Settings,
  Lock,
  Copy,
  SlidersHorizontal,
  Tags,
  MoreHorizontal,
  BarChart3,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  isScanning: boolean;
  scanProgress: { current: number; total: number };
  onScanDirectory: () => void;
  onImportData: () => void;
  onExportData: () => void;
  onExportPlaylist?: () => void;
  onBatchRename: () => void;
  onManagePresets: () => void;
  onCreateBackup: () => void;
  onCreateDirectory?: () => void;
  onDeleteDirectory?: () => void;
  onCancelScan?: () => void;
  onRescanLastRoot?: () => void;
  onOpenSettings?: () => void;
  onToggleFilters?: () => void;
  activeFilterCount?: number;
  isFiltersOpen?: boolean;
}

export function Header({
  isScanning,
  scanProgress,
  onScanDirectory,
  onImportData,
  onExportData,
  onExportPlaylist,
  onBatchRename,
  onManagePresets,
  onCreateBackup,
  onCreateDirectory,
  onDeleteDirectory,
  onCancelScan,
  onRescanLastRoot,
  onOpenSettings,
  onToggleFilters,
  activeFilterCount = 0,
  isFiltersOpen,
}: HeaderProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(AuthService.cachedIsAdmin);

  useEffect(() => {
    // Try to detect current auth state once when header mounts
    void AuthService.refresh();
    const unsubscribe = AuthService.subscribe(setIsAdmin);
    return () => {
      unsubscribe?.();
    };
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <header className="bg-card border-b border-border px-4 sm:px-6 py-4 sm:py-6 shadow-sm sticky top-0 z-30">
      {/* Main Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <Video className="text-primary text-2xl" />
          <h1 className="text-2xl font-bold text-foreground truncate">{t('app.title')}</h1>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {onToggleFilters && (
            <Button
              variant={isFiltersOpen ? 'default' : 'outline'}
              size="sm"
              className="px-3 min-h-[40px] lg:hidden"
              data-testid="button-open-filters"
              title="Toggle filters"
              onClick={onToggleFilters}
              aria-pressed={!!isFiltersOpen}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {t('header.filters')}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}

          {/* Settings Button */}
          {onOpenSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              data-testid="button-settings"
              className="p-2 min-h-[40px]"
              title="Settings"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}

          {/* Admin Login/Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void (async () => {
                if (isAdmin) {
                  await AuthService.logout();
                } else {
                  await AuthService.promptAndLogin();
                }
              })();
            }}
            data-testid="button-admin-login"
            className="px-3 min-h-[40px]"
            title={isAdmin ? t('header.adminLogout') : t('header.adminLogin')}
          >
            <Lock className="h-4 w-4 mr-1" />
            {t('header.adminLogin')}
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
            className="p-2 min-h-[40px]"
            title="Toggle theme"
            aria-label="Toggle theme"
            aria-pressed={theme === 'dark'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Action Buttons Row */}
      {/* Action Buttons Row */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Desktop View */}
        <div className="hidden lg:flex flex-wrap items-center gap-2">
          <Button
            onClick={onScanDirectory}
            disabled={isScanning}
            data-testid="button-scan-directory"
            variant="outline"
            size="sm"
            className="min-h-[40px]"
          >

            <FolderOpen className="mr-2 h-4 w-4" />
            {t('header.scanDirectory')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onImportData}
            data-testid="button-import-data"
            className="min-h-[40px]"
          >

            <Download className="mr-2 h-4 w-4" />
            {t('common.import')}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px]"
                data-testid="button-export-menu"
              >
                <Upload className="mr-2 h-4 w-4" />
                {t('common.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onExportData} data-testid="button-export-data">
                {t('header.exportLibrary')} (JSON)
              </DropdownMenuItem>
              {onExportPlaylist && (
                <DropdownMenuItem onClick={onExportPlaylist} data-testid="button-export-playlist">
                  {t('header.exportPlaylist')} (M3U/JSON)
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden lg:flex flex-wrap items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchRename}
            data-testid="button-batch-rename"
            className="min-h-[40px]"
          >

            <Edit className="mr-2 h-4 w-4" />
            {t('header.batchRename')}
          </Button>

          <Link href="/duplicates">
            <Button variant="outline" size="sm" data-testid="button-duplicates" className="min-h-[40px]">
              <Copy className="mr-2 h-4 w-4" />
              {t('header.duplicates')}
            </Button>
          </Link>

          <Link href="/tags">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-tags"
              className="min-h-[40px]"
            >
              <Tags className="mr-2 h-4 w-4" />
              {t('header.tags')}
            </Button>
          </Link>

          <Link href="/analytics">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-analytics"
              className="min-h-[40px]"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              {t('header.analytics')}
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={onManagePresets}
            data-testid="button-manage-presets"
            className="min-h-[40px]"
          >

            <ClipboardList className="mr-2 h-4 w-4" />
            {t('header.presets')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onCreateBackup}
            data-testid="button-create-backup"
            className="min-h-[40px]"
          >

            <Shield className="mr-2 h-4 w-4" />
            {t('header.backup')}
          </Button>

          {onCreateDirectory && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateDirectory}
              data-testid="button-create-directory"
              className="min-h-[40px]"
            >

              <FolderPlus className="mr-2 h-4 w-4" />
              {t('header.newFolder')}
            </Button>
          )}

          {onDeleteDirectory && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteDirectory}
              data-testid="button-delete-directory"
              className="min-h-[40px]"
            >

              <FolderMinus className="mr-2 h-4 w-4" />
              {t('header.deleteFolder')}
            </Button>
          )}

          {onToggleFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleFilters}
              className="min-h-[40px]"
              aria-pressed={!!isFiltersOpen}
              data-testid="button-open-filters-desktop"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {t('header.filters')}
              {activeFilterCount > 0 && (
                <Badge variant="outline" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
        </div>

        {/* Mobile View */}
        <div className="flex lg:hidden items-center gap-2 w-full">
          <Button
            onClick={onScanDirectory}
            disabled={isScanning}
            data-testid="button-scan-directory-mobile"
            variant="outline"
            size="sm"
            className="flex-1 min-h-[40px]"
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Scan
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-[40px] px-3" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onImportData}>
                <Download className="mr-2 h-4 w-4" /> Import Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportData}>
                <Upload className="mr-2 h-4 w-4" /> Export Library
              </DropdownMenuItem>
              {onExportPlaylist && (
                <DropdownMenuItem onClick={onExportPlaylist}>
                  <Upload className="mr-2 h-4 w-4" /> Export Playlist
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onBatchRename}>
                <Edit className="mr-2 h-4 w-4" /> Batch Rename
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/duplicates" className="w-full cursor-pointer flex items-center">
                  <Copy className="mr-2 h-4 w-4" /> Duplicates
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/tags" className="w-full cursor-pointer flex items-center">
                  <Tags className="mr-2 h-4 w-4" /> Tags
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/analytics" className="w-full cursor-pointer flex items-center">
                  <BarChart3 className="mr-2 h-4 w-4" /> Analytics
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManagePresets}>
                <ClipboardList className="mr-2 h-4 w-4" /> Presets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateBackup}>
                <Shield className="mr-2 h-4 w-4" /> Backup
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onCreateDirectory && (
                <DropdownMenuItem onClick={onCreateDirectory}>
                  <FolderPlus className="mr-2 h-4 w-4" /> New Folder
                </DropdownMenuItem>
              )}
              {onDeleteDirectory && (
                <DropdownMenuItem onClick={onDeleteDirectory} className="text-destructive">
                  <FolderMinus className="mr-2 h-4 w-4" /> Delete Folder
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Progress Bar (shown when scanning) */}
      {isScanning && (
        <div className="flex items-center justify-center mt-4 pt-4 border-t border-border">
          <div className="flex items-center space-x-3" data-testid="scan-progress">
            <span className="text-sm text-muted-foreground">Scanning files...</span>
            <div className="w-48">
              <Progress
                value={
                  scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0
                }
                className="h-2"
              />
            </div>
            <span className="text-sm font-medium text-foreground">
              {scanProgress.current}/{scanProgress.total}
            </span>
            {onCancelScan && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onCancelScan}
                data-testid="button-cancel-scan"
                className="min-h-[38px]"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
