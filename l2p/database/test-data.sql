-- Test data for Learn2Play integration tests
-- This file contains sample data for testing various scenarios

-- Insert test users (conditionally to avoid duplicates)
INSERT INTO users (id, username, email, password_hash, email_verified, is_admin, created_at, updated_at) VALUES
(1, 'testuser1', 'test1@example.com', '$2b$10$CGwWOyhyugxfTxsej2ov5ezJzxug73TxiTFBTeT0zTcFaLc3ZF4t.', true, false, NOW(), NOW()),
(2, 'testuser2', 'test2@example.com', '$2b$10$CGwWOyhyugxfTxsej2ov5ezJzxug73TxiTFBTeT0zTcFaLc3ZF4t.', true, false, NOW(), NOW()),
(3, 'testuser3', 'test3@example.com', '$2b$10$CGwWOyhyugxfTxsej2ov5ezJzxug73TxiTFBTeT0zTcFaLc3ZF4t.', false, false, NOW(), NOW()),
(4, 'admin', 'admin@example.com', '$2b$10$CGwWOyhyugxfTxsej2ov5ezJzxug73TxiTFBTeT0zTcFaLc3ZF4t.', true, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test question sets (conditionally to avoid duplicates)
INSERT INTO question_sets (id, name, description, category, difficulty, is_active, is_public, is_featured, created_at, updated_at) VALUES
(1, 'Test Game 1', 'A simple test game for integration testing', 'puzzle', 'easy', true, true, true, NOW(), NOW()),
(2, 'Test Game 2', 'A medium difficulty test game', 'strategy', 'medium', true, true, true, NOW(), NOW()),
(3, 'Test Game 3', 'A hard test game for advanced testing', 'action', 'hard', true, true, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test lobbies (conditionally to avoid duplicates)
INSERT INTO lobbies (id, code, name, host_id, status, current_players, question_set_id, created_at, game_settings) VALUES
(1, 'TEST001', 'Test Lobby 1', 1, 'playing', 2, 1, NOW(), '{"max_players": 4}'::jsonb),
(2, 'TEST002', 'Test Lobby 2', 2, 'playing', 3, 2, NOW(), '{"max_players": 4}'::jsonb),
(3, 'TEST003', 'Test Lobby 3', 4, 'ended', 4, 3, NOW(), '{"max_players": 4}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Insert test questions (conditionally to avoid duplicates)
INSERT INTO questions (id, question_set_id, question_text, answers, difficulty) VALUES
(1, 1, '{"en": "What is 2 + 2?", "de": "Was ist 2 + 2?"}'::jsonb, '[{"text": {"en": "4", "de": "4"}, "correct": true}, {"text": {"en": "3", "de": "3"}, "correct": false}, {"text": {"en": "5", "de": "5"}, "correct": false}, {"text": {"en": "6", "de": "6"}, "correct": false}]'::jsonb, 1),
(2, 1, '{"en": "What color is the sky?", "de": "Welche Farbe hat der Himmel?"}'::jsonb, '[{"text": {"en": "blue", "de": "blau"}, "correct": true}, {"text": {"en": "red", "de": "rot"}, "correct": false}, {"text": {"en": "green", "de": "grün"}, "correct": false}, {"text": {"en": "yellow", "de": "gelb"}, "correct": false}]'::jsonb, 1),
(3, 2, '{"en": "What is the capital of France?", "de": "Was ist die Hauptstadt von Frankreich?"}'::jsonb, '[{"text": {"en": "Paris", "de": "Paris"}, "correct": true}, {"text": {"en": "London", "de": "London"}, "correct": false}, {"text": {"en": "Berlin", "de": "Berlin"}, "correct": false}, {"text": {"en": "Madrid", "de": "Madrid"}, "correct": false}]'::jsonb, 2),
(4, 2, '{"en": "How many sides does a triangle have?", "de": "Wie viele Seiten hat ein Dreieck?"}'::jsonb, '[{"text": {"en": "3", "de": "3"}, "correct": true}, {"text": {"en": "2", "de": "2"}, "correct": false}, {"text": {"en": "4", "de": "4"}, "correct": false}, {"text": {"en": "5", "de": "5"}, "correct": false}]'::jsonb, 2),
(5, 3, '{"en": "What is the largest planet in our solar system?", "de": "Was ist der größte Planet in unserem Sonnensystem?"}'::jsonb, '[{"text": {"en": "Jupiter", "de": "Jupiter"}, "correct": true}, {"text": {"en": "Earth", "de": "Erde"}, "correct": false}, {"text": {"en": "Mars", "de": "Mars"}, "correct": false}, {"text": {"en": "Saturn", "de": "Saturn"}, "correct": false}]'::jsonb, 3)
ON CONFLICT (id) DO NOTHING;

-- Insert test game sessions (conditionally to avoid duplicates)
INSERT INTO game_sessions (id, lobby_id, question_set_id, started_at, ended_at, status, settings) VALUES
(1, 1, 1, NOW(), NULL, 'active', '{}'::jsonb),
(2, 2, 2, NOW(), NULL, 'active', '{}'::jsonb),
(3, 3, 3, NOW(), NOW(), 'ended', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Insert test player results (conditionally to avoid duplicates)
INSERT INTO player_results (session_id, user_id, username, character_name, score, accuracy, questions_answered, correct_answers, experience_gained, level_achieved, level_up_occurred, max_multiplier, total_experience, game_duration, completed_at, metadata) VALUES
(1, 1, 'testuser1', 'Character1', 0, 0.00, 0, 0, 0, 1, false, 1.00, 0, 0, NOW(), '{}'::jsonb),
(1, 2, 'testuser2', 'Character2', 0, 0.00, 0, 0, 0, 1, false, 1.00, 0, 0, NOW(), '{}'::jsonb),
(2, 2, 'testuser2', 'Character1', 25, 85.00, 10, 8, 50, 2, false, 1.50, 100, 120, NOW(), '{}'::jsonb),
(2, 3, 'testuser3', 'Character3', 15, 75.00, 10, 6, 30, 1, false, 1.25, 50, 135, NOW(), '{}'::jsonb),
(2, 4, 'admin', 'AdminCharacter', 30, 90.00, 10, 9, 75, 3, true, 2.00, 150, 105, NOW(), '{}'::jsonb),
(3, 4, 'admin', 'AdminCharacter', 100, 100.00, 10, 10, 200, 5, true, 2.50, 500, 90, NOW(), '{}'::jsonb),
(3, 1, 'testuser1', 'Character1', 85, 85.00, 10, 8, 150, 4, true, 2.00, 400, 100, NOW(), '{}'::jsonb),
(3, 2, 'testuser2', 'Character2', 90, 90.00, 10, 9, 180, 4, true, 2.25, 450, 95, NOW(), '{}'::jsonb),
(3, 3, 'testuser3', 'Character3', 75, 75.00, 10, 7, 120, 3, false, 1.75, 300, 110, NOW(), '{}'::jsonb);

-- Insert test hall of fame entries (conditionally to avoid duplicates)
INSERT INTO hall_of_fame (question_set_id, username, character_name, score, accuracy, questions_answered, correct_answers, experience_gained, level_achieved, max_multiplier, total_experience, game_duration, completed_at, metadata) VALUES
(1, 'testuser1', 'Character1', 150, 95.00, 10, 9, 100, 3, 1.50, 300, 120, NOW() - INTERVAL '1 day', '{}'::jsonb),
(1, 'testuser2', 'Character2', 140, 90.00, 10, 8, 80, 2, 1.25, 200, 130, NOW() - INTERVAL '2 days', '{}'::jsonb),
(1, 'testuser3', 'Character3', 160, 98.00, 10, 10, 150, 4, 2.00, 400, 110, NOW() - INTERVAL '3 days', '{}'::jsonb),
(2, 'admin', 'AdminCharacter', 200, 85.00, 15, 12, 200, 5, 1.75, 500, 180, NOW() - INTERVAL '1 day', '{}'::jsonb),
(2, 'testuser1', 'Character1', 180, 80.00, 15, 11, 150, 4, 1.50, 400, 200, NOW() - INTERVAL '2 days', '{}'::jsonb),
(3, 'testuser2', 'Character2', 250, 92.00, 20, 18, 300, 6, 2.25, 700, 300, NOW() - INTERVAL '1 day', '{}'::jsonb),
(3, 'admin', 'AdminCharacter', 300, 95.00, 20, 19, 400, 7, 2.50, 900, 280, NOW() - INTERVAL '2 days', '{}'::jsonb);

-- Note: user_settings table is not defined in the schema, so these inserts are commented out
-- INSERT INTO user_settings (user_id, theme, language, sound_enabled, notifications_enabled, created_at, updated_at) VALUES
-- (1, 'dark', 'en', true, true, NOW(), NOW()),
-- (2, 'light', 'de', false, true, NOW(), NOW()),
-- (3, 'dark', 'en', true, false, NOW(), NOW()),
-- (4, 'light', 'en', true, true, NOW(), NOW());

-- Note: chat_messages table is not defined in the schema, so these inserts are commented out
-- INSERT INTO chat_messages (id, session_id, user_id, message, message_type, created_at) VALUES
-- (1, 1, 1, 'Hello everyone!', 'text', NOW() - INTERVAL '5 minutes'),
-- (2, 1, 2, 'Hi there!', 'text', NOW() - INTERVAL '4 minutes'),
-- (3, 2, 2, 'Good game!', 'text', NOW() - INTERVAL '3 minutes'),
-- (4, 2, 4, 'Thanks!', 'text', NOW() - INTERVAL '2 minutes'),
-- (5, 2, 3, 'Well played!', 'text', NOW() - INTERVAL '1 minute');

-- Note: game_statistics table is not defined in the schema, so these inserts are commented out
-- INSERT INTO game_statistics (user_id, question_set_id, games_played, total_score, average_score, best_score, total_time, created_at, updated_at) VALUES
-- (1, 1, 5, 750, 150, 180, 600, NOW(), NOW()),
-- (2, 1, 3, 420, 140, 160, 390, NOW(), NOW()),
-- (3, 1, 4, 640, 160, 170, 440, NOW(), NOW()),
-- (4, 2, 2, 400, 200, 200, 360, NOW(), NOW()),
-- (1, 2, 1, 180, 180, 180, 200, NOW(), NOW()),
-- (2, 3, 2, 500, 250, 250, 600, NOW(), NOW()),
-- (4, 3, 1, 300, 300, 300, 280, NOW(), NOW());

-- Note: notifications table is not defined in the schema, so these inserts are commented out
-- INSERT INTO notifications (id, user_id, type, title, message, read, created_at) VALUES
-- (1, 1, 'achievement', 'Achievement Unlocked!', 'You earned the First Game achievement!', false, NOW() - INTERVAL '5 days'),
-- (2, 2, 'game_invite', 'Game Invitation', 'testuser2 invited you to play Test Game 1', false, NOW() - INTERVAL '1 hour'),
-- (3, 2, 'achievement', 'Achievement Unlocked!', 'You earned the Speed Demon achievement!', true, NOW() - INTERVAL '3 days'),
-- (4, 4, 'system', 'System Update', 'New features are available!', false, NOW() - INTERVAL '1 day'),
-- (5, 3, 'game_result', 'Game Result', 'You finished Test Game 2 with a score of 75!', false, NOW() - INTERVAL '30 minutes');

-- Note: friendships table is not defined in the schema, so these inserts are commented out
-- INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at) VALUES
-- ('test-user-1', 'test-user-2', 'accepted', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
-- ('test-user-2', 'test-user-1', 'accepted', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
-- ('test-user-1', 'test-user-3', 'pending', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- ('test-user-3', 'test-user-1', 'pending', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- ('admin-user', 'test-user-1', 'accepted', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
-- ('test-user-1', 'admin-user', 'accepted', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');

-- Note: game_categories table is not defined in the schema, so these inserts are commented out
-- INSERT INTO game_categories (id, name, description, icon, created_at) VALUES
-- ('puzzle', 'Puzzle Games', 'Brain teasers and logic puzzles', '🧩', NOW()),
-- ('strategy', 'Strategy Games', 'Strategic thinking and planning', '🎯', NOW()),
-- ('action', 'Action Games', 'Fast-paced action and reflexes', '⚡', NOW()),
-- ('educational', 'Educational', 'Learning and knowledge games', '📚', NOW()),
-- ('social', 'Social Games', 'Multiplayer and social interaction', '👥', NOW());

-- Note: game_tags table is not defined in the schema, so these inserts are commented out
-- INSERT INTO game_tags (question_set_id, tag) VALUES
-- (1, 'puzzle'),
-- (1, 'easy'),
-- (1, 'beginner'),
-- (2, 'strategy'),
-- (2, 'medium'),
-- (2, 'multiplayer'),
-- (3, 'action'),
-- (3, 'hard'),
-- (3, 'advanced');

-- Note: user_preferences table is not defined in the schema, so these inserts are commented out
-- INSERT INTO user_preferences (user_id, preference_key, preference_value, created_at, updated_at) VALUES
-- ('test-user-1', 'auto_join_games', 'true', NOW(), NOW()),
-- ('test-user-1', 'show_tutorials', 'false', NOW(), NOW()),
-- ('test-user-2', 'auto_join_games', 'false', NOW(), NOW()),
-- ('test-user-2', 'show_tutorials', 'true', NOW(), NOW()),
-- ('test-user-3', 'auto_join_games', 'true', NOW(), NOW()),
-- ('test-user-3', 'show_tutorials', 'true', NOW(), NOW()),
-- ('admin-user', 'auto_join_games', 'false', NOW(), NOW()),
-- ('admin-user', 'show_tutorials', 'false', NOW(), NOW());

-- Note: game_feedback table is not defined in the schema, so these inserts are commented out
-- INSERT INTO game_feedback (id, user_id, question_set_id, rating, comment, created_at) VALUES
-- (1, 1, 1, 5, 'Great game for beginners!', NOW() - INTERVAL '3 days'),
-- (2, 2, 1, 4, 'Enjoyable puzzle game', NOW() - INTERVAL '2 days'),
-- (3, 4, 2, 5, 'Excellent strategy game', NOW() - INTERVAL '1 day'),
-- (4, 3, 3, 3, 'Too difficult for me', NOW() - INTERVAL '1 day');

-- Note: system_logs table is not defined in the schema, so these inserts are commented out
-- INSERT INTO system_logs (id, level, message, user_id, session_id, created_at) VALUES
-- (1, 'info', 'User testuser1 logged in', 1, NULL, NOW() - INTERVAL '1 hour'),
-- (2, 'info', 'Game session test-session-1 created', NULL, 1, NOW() - INTERVAL '2 hours'),
-- (3, 'warning', 'High memory usage detected', NULL, NULL, NOW() - INTERVAL '30 minutes'),
-- (4, 'error', 'Database connection timeout', NULL, NULL, NOW() - INTERVAL '15 minutes'),
-- (5, 'info', 'User testuser2 joined game session', 2, 1, NOW() - INTERVAL '1 hour');

-- Note: rate_limits table is not defined in the schema, so these inserts are commented out
-- INSERT INTO rate_limits (ip_address, endpoint, request_count, window_start, created_at) VALUES
-- ('192.168.1.100', '/api/auth/login', 3, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '10 minutes'),
-- ('192.168.1.101', '/api/games', 15, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '5 minutes'),
-- ('192.168.1.102', '/api/users/profile', 1, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '2 minutes');

-- Note: email_templates table is not defined in the schema, so these inserts are commented out
-- INSERT INTO email_templates (id, name, subject, body, variables, created_at, updated_at) VALUES
-- ('welcome', 'Welcome Email', 'Welcome to Learn2Play!', 'Hello {{username}}, welcome to Learn2Play!', '["username"]', NOW(), NOW()),
-- ('password-reset', 'Password Reset', 'Reset Your Password', 'Click here to reset your password: {{resetLink}}', '["resetLink"]', NOW(), NOW()),
-- ('game-invite', 'Game Invitation', 'You''ve been invited to play!', '{{inviterName}} invited you to play {{gameName}}', '["inviterName", "gameName"]', NOW(), NOW()),
-- ('achievement', 'Achievement Unlocked', 'Congratulations!', 'You earned the {{achievementName}} achievement!', '["achievementName"]', NOW(), NOW());

-- Note: email_queue table is not defined in the schema, so these inserts are commented out
-- INSERT INTO email_queue (id, template_id, user_id, variables, status, created_at, sent_at) VALUES
-- (1, 'welcome', 1, '{"username": "testuser1"}', 'sent', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
-- (2, 'password-reset', 2, '{"resetLink": "http://localhost:3000/reset?token=abc123"}', 'pending', NOW() - INTERVAL '1 hour', NULL),
-- (3, 'game-invite', 3, '{"inviterName": "testuser1", "gameName": "Test Game 1"}', 'sent', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '25 minutes'),
-- (4, 'achievement', 4, '{"achievementName": "Perfect Score"}', 'sent', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- Note: audit_logs table is not defined in the schema, so these inserts are commented out
-- INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address, created_at) VALUES
-- (1, 1, 'login', 'user', '1', '{"method": "email", "success": true}', '192.168.1.100', NOW() - INTERVAL '1 hour'),
-- (2, 1, 'create', 'game_session', '1', '{"game_id": "test-game-1", "max_players": 4}', '192.168.1.100', NOW() - INTERVAL '2 hours'),
-- (3, 2, 'join', 'game_session', '1', '{"session_id": "test-session-1"}', '192.168.1.101', NOW() - INTERVAL '1 hour'),
-- (4, 4, 'update', 'user', '1', '{"field": "email_verified", "old_value": false, "new_value": true}', '192.168.1.102', NOW() - INTERVAL '30 minutes'),
-- (5, 3, 'delete', 'game_session', '3', '{"session_id": "test-session-3", "reason": "completed"}', '192.168.1.103', NOW() - INTERVAL '15 minutes'); 