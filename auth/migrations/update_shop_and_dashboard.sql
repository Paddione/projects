-- Update app URLs and names for shop and dashboard
UPDATE auth.apps SET url = 'https://shop.korczewski.de' WHERE key = 'payment';
