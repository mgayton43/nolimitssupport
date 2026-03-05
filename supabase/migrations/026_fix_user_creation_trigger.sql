-- Fix user creation trigger to handle role from metadata (for invitations)

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role_val user_role;
BEGIN
    -- Get role from metadata, default to 'agent' if not specified or invalid
    user_role_val := CASE
        WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'agent', 'viewer')
        THEN (NEW.raw_user_meta_data->>'role')::user_role
        ELSE 'agent'::user_role
    END;

    INSERT INTO profiles (id, email, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url',
        user_role_val
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
