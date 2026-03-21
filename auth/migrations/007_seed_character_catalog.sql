-- Seed purchasable characters into shop catalog (500 Respect each)
-- Student is free (not in catalog)
INSERT INTO auth.shop_catalog (item_id, item_type, name, description, respect_cost, unlock_level, active)
VALUES
  ('character_professor', 'character', 'Professor', 'Wise and knowledgeable academic', 500, NULL, true),
  ('character_librarian', 'character', 'Librarian', 'Organized keeper of knowledge', 500, NULL, true),
  ('character_researcher', 'character', 'Researcher', 'Curious explorer of new ideas', 500, NULL, true),
  ('character_dean', 'character', 'Dean', 'Distinguished academic leader', 500, NULL, true),
  ('character_graduate', 'character', 'Graduate', 'Accomplished scholar', 500, NULL, true),
  ('character_lab_assistant', 'character', 'Lab Assistant', 'Hands-on experimenter', 500, NULL, true),
  ('character_teaching_assistant', 'character', 'Teaching Assistant', 'Supportive mentor and guide', 500, NULL, true)
ON CONFLICT (item_id) DO NOTHING;
