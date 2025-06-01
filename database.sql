-- MindfulSpace Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    age INTEGER,
    gender VARCHAR(50),
    bio TEXT,
    profile_complete BOOLEAN DEFAULT FALSE,
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category VARCHAR(100),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mood tracking table
CREATE TABLE IF NOT EXISTS mood_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    mood VARCHAR(50) NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Gratitude entries table
CREATE TABLE IF NOT EXISTS gratitude_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friend connections table
CREATE TABLE IF NOT EXISTS friend_requests (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    requested_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(requester_id, requested_id)
);

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(100) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_type)
);

-- Support interactions table (for tracking support sent/received)
CREATE TABLE IF NOT EXISTS support_interactions (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) DEFAULT 'support', -- support, share
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_public ON journal_entries(is_public);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_date ON mood_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_gratitude_entries_user_date ON gratitude_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requested ON friend_requests(requested_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_support_interactions_sender ON support_interactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_interactions_receiver ON support_interactions(receiver_id);

-- Insert sample users (passwords are hashed for 'password123')
INSERT INTO users (email, password, name, age, gender, bio, profile_complete, join_date) VALUES
('sarah@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sarah Johnson', 28, 'female', 'Mental health advocate and yoga enthusiast. Finding peace in mindfulness.', true, NOW() - INTERVAL '30 days'),
('michael@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Michael Chen', 34, 'male', 'Meditation practitioner and wellness coach. Here to support and grow.', true, NOW() - INTERVAL '15 days'),
('emma@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Emma Rodriguez', 25, 'female', 'Art therapy student learning to heal through creativity and community.', true, NOW() - INTERVAL '7 days')
ON CONFLICT (email) DO NOTHING;

-- Insert sample journal entries
INSERT INTO journal_entries (user_id, content, category, is_public, created_at) VALUES
(1, 'Today I practiced gratitude meditation for 20 minutes. It helped me center myself and appreciate the small moments of joy in my day. The morning sunlight through my window felt like a warm hug.', 'mindfulness', true, NOW() - INTERVAL '2 days'),
(2, 'Dealing with work stress has been challenging lately. I''ve been using breathing exercises and they really help. Remember: this too shall pass. Taking it one day at a time.', 'stress', true, NOW() - INTERVAL '1 day'),
(3, 'Art therapy session today was incredible. I painted my emotions and it felt so liberating. Colors have a way of expressing what words cannot. Feeling grateful for this healing journey.', 'personal-growth', true, NOW())
ON CONFLICT DO NOTHING;

-- Insert sample mood entries
INSERT INTO mood_entries (user_id, mood, emoji, date) VALUES
(1, 'happy', '😊', CURRENT_DATE - INTERVAL '2 days'),
(1, 'calm', '😌', CURRENT_DATE - INTERVAL '1 day'),
(1, 'happy', '😊', CURRENT_DATE),
(2, 'anxious', '😰', CURRENT_DATE - INTERVAL '2 days'),
(2, 'calm', '😌', CURRENT_DATE - INTERVAL '1 day'),
(2, 'happy', '😊', CURRENT_DATE),
(3, 'happy', '😊', CURRENT_DATE - INTERVAL '1 day'),
(3, 'calm', '😌', CURRENT_DATE)
ON CONFLICT (user_id, date) DO NOTHING;

-- Insert sample gratitude entries
INSERT INTO gratitude_entries (user_id, content, date) VALUES
(1, 'I''m grateful for my morning coffee and the peaceful start to my day', CURRENT_DATE),
(1, 'Thankful for supportive friends who listen without judgment', CURRENT_DATE - INTERVAL '1 day'),
(2, 'Grateful for the opportunity to help others on their wellness journey', CURRENT_DATE),
(3, 'I''m thankful for art as a form of expression and healing', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Insert sample achievements
INSERT INTO user_achievements (user_id, achievement_type) VALUES
(1, 'first-entry'),
(1, 'mood-tracker'),
(1, 'grateful-heart'),
(1, 'community-member'),
(2, 'first-entry'),
(2, 'mood-tracker'),
(2, 'community-member'),
(3, 'first-entry'),
(3, 'community-member')
ON CONFLICT (user_id, achievement_type) DO NOTHING;