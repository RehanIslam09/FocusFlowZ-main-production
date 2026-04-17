import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function useSupabase() {
    const { getToken } = useAuth();
    const [supabase, setSupabase] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const initSupabase = async () => {
            try {
                const token = await getToken({ template: "supabase" });

                if (!token) {
                    console.warn("No Clerk token found");
                    return;
                }

                const client = createClient(
                    import.meta.env.VITE_SUPABASE_URL,
                    import.meta.env.VITE_SUPABASE_ANON_KEY,
                    {
                        global: {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        },
                    }
                );

                if (isMounted) {
                    setSupabase(client);
                }
            } catch (error) {
                console.error("Supabase init error:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initSupabase();

        return () => {
            isMounted = false;
        };
    }, [getToken]);

    return { supabase, loading };
}