// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://hdqtnfbvgsgcwwlpddry.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcXRuZmJ2Z3NnY3d3bHBkZHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzNDIxODgsImV4cCI6MjA1MzkxODE4OH0.qBmitN44aGxCiK3LoIAhqDiYm1YzfCoNwKpOpGCIqic',
};

// Initialize Supabase client with error handling
let supabaseClient;
try {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.log('Supabase initialized successfully');
} catch (error) {
    console.error('Error initializing Supabase:', error.message);
}

// Export the client for use in other files
const getSupabaseClient = () => supabaseClient;

// Database helper functions
const db = {
    // User functions
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();
            if (error) throw error;
            return user;
        } catch (error) {
            console.error('Error getting current user:', error.message);
            return null;
        }
    },

    async getUserRole() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return null;

            const { data, error } = await supabaseClient
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();

            if (error) throw error;
            return data.role;
        } catch (error) {
            console.error('Error getting user role:', error.message);
            return null;
        }
    },

    // Profile functions
    async getProfile() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return null;

            const { data, error } = await supabaseClient
                .from('employee_profiles')
                .select(`
                    *,
                    departments (
                        name,
                        description
                    )
                `)
                .eq('user_id', user.id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting profile:', error.message);
            return null;
        }
    },

    // Request functions
    async createRequest({ type_id, title, description }) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await supabaseClient
                .from('requests')
                .insert({
                    user_id: user.id,
                    request_type_id: type_id,
                    title,
                    description
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating request:', error.message);
            throw error;
        }
    },

    async getRequests() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return [];

            const { data, error } = await supabaseClient
                .from('requests')
                .select(`
                    *,
                    request_types (
                        name,
                        description
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting requests:', error.message);
            return [];
        }
    },

    // Attendance functions
    async checkIn() {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await supabaseClient
                .from('attendance')
                .insert({
                    user_id: user.id,
                    check_in: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error checking in:', error.message);
            throw error;
        }
    },

    async checkOut(attendanceId) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await supabaseClient
                .from('attendance')
                .update({
                    check_out: new Date().toISOString()
                })
                .eq('id', attendanceId)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error checking out:', error.message);
            throw error;
        }
    },

    // Notification functions
    async getNotifications() {
        try {
            const user = await this.getCurrentUser();
            if (!user) return [];

            const { data, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting notifications:', error.message);
            return [];
        }
    },

    async markNotificationAsRead(notificationId) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            const { error } = await supabaseClient
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId)
                .eq('user_id', user.id);

            if (error) throw error;
        } catch (error) {
            console.error('Error marking notification as read:', error.message);
            throw error;
        }
    }
};

// Export database helper functions
const getDatabase = () => db;
