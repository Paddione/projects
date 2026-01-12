-- Update app URLs from localhost to production domains
UPDATE auth.apps SET url = 'https://l2p.korczewski.de' WHERE key = 'l2p';
UPDATE auth.apps SET url = 'https://videovault.korczewski.de' WHERE key = 'videovault';
UPDATE auth.apps SET url = 'https://payment.korczewski.de' WHERE key = 'payment';
UPDATE auth.apps SET url = 'https://dashboard.korczewski.de' WHERE key = 'vllm-dashboard';
