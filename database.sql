-- MindfulSpace Database Schema
-- PostgreSQL Database Setup

-- Create database (run this separately if needed)
-- CREATE DATABASE mindfulspace;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    age INTEGER,
    gender VARCHAR(50),
    bio TEXT,
    profile_complete BOOLEAN DEFAULT FALSE,
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

-- User sessions table (for JWT token management)
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_public ON journal_entries(is_public);
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_date ON mood_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_gratitude_entries_user_date ON gratitude_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requested ON friend_requests(requested_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert sample users
INSERT INTO users (name, email, password, age, gender, bio, profile_complete) VALUES
('Sarah Johnson', 'sarah@example.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 28, 'female', 'Mental health advocate and yoga enthusiast. Finding peace in mindfulness.', true),
('Michael Chen', 'michael@example.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 34, 'male', 'Meditation practitioner and wellness coach. Here to support and grow.', true),
('Emma Rodriguez', 'emma@example.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 25, 'female', 'Art therapy student learning to heal through creativity and community.', true),
('Alex Thompson', 'alex@example.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 31, 'non-binary', 'Mindfulness teacher and nature lover. Spreading peace one breath at a time.', true),
('Jordan Kim', 'jordan@example.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 29, 'male', 'Software developer finding balance between technology and mental wellness.', true);

-- Insert sample journal entries
INSERT INTO journal_entries (user_id, content, category, is_public, created_at) VALUES
(1, 'Today I practiced gratitude meditation for 20 minutes. It helped me center myself and appreciate the small moments of joy in my day. The morning sunlight through my window felt like a warm hug.', 'mindfulness', true, NOW() - INTERVAL '2 days'),
(2, 'Dealing with work stress has been challenging lately. I''ve been using breathing exercises and they really help. Remember: this too shall pass. Taking it one day at a time.', 'stress', true, NOW() - INTERVAL '1 day'),
(3, 'Art therapy session today was incredible. I painted my emotions and it felt so liberating. Colors have a way of expressing what words cannot. Feeling grateful for this healing journey.', 'personal-growth', true, NOW()),
(1, 'Had a difficult conversation with my family today. Feeling emotionally drained but proud that I stood up for my boundaries. Self-care is not selfish.', 'relationships', false, NOW() - INTERVAL '3 days'),
(4, 'Morning walk in the forest was exactly what my soul needed. The sound of birds and rustling leaves reminded me that peace is always available in nature.', 'self-care', true, NOW() - INTERVAL '1 day'),
(5, 'Struggling with imposter syndrome at work again. Writing helps me process these feelings. I am capable, I am learning, and I belong here.', 'work', true, NOW() - INTERVAL '4 hours');

-- Insert sample mood entries
INSERT INTO mood_entries (user_id, mood, emoji, date) VALUES
(1, 'happy', '😊', CURRENT_DATE),
(1, 'calm', '😌', CURRENT_DATE - INTERVAL '1 day'),
(1, 'anxious', '😰', CURRENT_DATE - INTERVAL '2 days'),
(2, 'tired', '😴', CURRENT_DATE),
(2, 'sad', '😢', CURRENT_DATE - INTERVAL '1 day'),
(3, 'happy', '😊', CURRENT_DATE),
(3, 'calm', '😌', CURRENT_DATE - INTERVAL '1 day'),
(4, 'calm', '😌', CURRENT_DATE),
(5, 'anxious', '😰', CURRENT_DATE);

-- Insert sample gratitude entries
INSERT INTO gratitude_entries (user_id, content, date) VALUES
(1, 'I''m grateful for my morning coffee and the quiet moments before the day begins.', CURRENT_DATE),
(1, 'Thankful for my supportive friends who listen without judgment.', CURRENT_DATE),
(2, 'Grateful for the opportunity to help others through my work.', CURRENT_DATE),
(3, 'I appreciate the beauty of art and how it helps me express my emotions.', CURRENT_DATE),
(4, 'Thankful for the peaceful moments in nature that restore my energy.', CURRENT_DATE),
(5, 'Grateful for the learning opportunities that challenge me to grow.', CURRENT_DATE);

-- Insert sample friend requests
INSERT INTO friend_requests (requester_id, requested_id, status) VALUES
(1, 2, 'accepted'),
(1, 3, 'accepted'),
(2, 4, 'pending'),
(3, 5, 'pending'),
(4, 1, 'accepted');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_friend_requests_updated_at BEFORE UPDATE ON friend_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
