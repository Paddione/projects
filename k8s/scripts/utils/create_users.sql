DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'auth_user') THEN 
    CREATE USER auth_user WITH PASSWORD 'AUTH_DB_PASS'; 
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'l2p_user') THEN 
    CREATE USER l2p_user WITH PASSWORD 'L2P_DB_PASS'; 
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'payment_user') THEN 
    CREATE USER payment_user WITH PASSWORD 'PAYMENT_DB_PASS'; 
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'videovault_user') THEN 
    CREATE USER videovault_user WITH PASSWORD 'VIDEOVAULT_DB_PASS'; 
  END IF;
END $$;
