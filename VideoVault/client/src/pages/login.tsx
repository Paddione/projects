import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthService } from '@/services/auth';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [, setLocation] = useLocation();
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await AuthService.login(username, password);
            if (res.ok) {
                setLocation('/');
            } else {
                setError(res.message || 'Login failed. Please check your credentials.');
            }
        } catch (_err: unknown) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
            <Card className="w-full max-w-md mx-4 shadow-lg border-primary/20">
                <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ShieldAlert className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold">VideoVault Admin</CardTitle>
                    </div>
                    <CardDescription>
                        Enter your credentials to access administrative features.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="admin"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            className="w-full"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <LogIn className="h-4 w-4 mr-2" />
                            )}
                            {isLoading ? 'Logging in...' : 'Sign In'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
