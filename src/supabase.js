import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nxrqpelgoryfvpcvtfbb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnFwZWxnb3J5ZnZwY3Z0ZmJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjA5NzYsImV4cCI6MjA4OTAzNjk3Nn0.T1xTXqnSMkYtomUOXMJt4xWeIkEMP7pgxIpVjuNqKqg'

export const supabase = createClient(supabaseUrl, supabaseKey)
