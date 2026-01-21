-- Update app URLs from localhost to production domains
UPDATE auth.apps SET url = 'https://l2p.korczewski.de' WHERE key = 'l2p';
UPDATE auth.apps SET url = 'https://videovault.korczewski.de' WHERE key = 'videovault';
UPDATE auth.apps SET url = 'https://shop.korczewski.de' WHERE key = 'payment';
