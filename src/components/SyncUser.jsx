import { useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import useSupabase from "../hooks/useSupabase";

export default function SyncUser() {
    const { user } = useUser();
    const { supabase, loading } = useSupabase();

    useEffect(() => {
        if (!user || !supabase || loading) return;

        const sync = async () => {
            const { error } = await supabase
                .from("users")
                .upsert(
                    {
                        id: user.id,
                        email: user.primaryEmailAddress?.emailAddress,
                        username: user.username || null,
                    },
                    {
                        onConflict: "id", // prevents duplicates
                    }
                );

            if (error) {
                console.error("Sync user error:", error);
            }
        };

        sync();
    }, [user, supabase, loading]);

    return null;
}