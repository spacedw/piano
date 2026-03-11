import { useState, useEffect } from 'react';
import { getUserProfile, updateProfile, getUser } from '../engine/SupabaseClient';

/**
 * Hook to manage user tier and quotas.
 * Supporter tier gets unlimited uploads and 500MB cloud storage.
 * Free tier gets 3 uploads per month.
 */
export function useUserTier() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadProfile() {
            setLoading(true);
            const user = await getUser();
            if (!user) {
                if (mounted) setLoading(false);
                return;
            }

            let p = await getUserProfile();
            
            // If we have a profile, check if we need to reset the monthly counter.
            if (p) {
                const now = new Date();
                const lastReset = p.last_upload_reset ? new Date(p.last_upload_reset) : null;
                
                // If it's a new month compared to lastReset
                if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
                    // Reset uploads_this_month to 0
                    try {
                        const updated = await updateProfile({
                            uploads_this_month: 0,
                            last_upload_reset: now.toISOString()
                        });
                        if (updated) p = updated;
                    } catch (e) {
                        // Columns may not exist yet — continue with current profile
                    }
                }
                if (mounted) setProfile(p);
            }
            if (mounted) setLoading(false);
        }

        loadProfile();

        return () => {
            mounted = false;
        };
    }, []);

    const isSupporter = profile?.tier === 'supporter';
    const uploadsThisMonth = profile?.uploads_this_month || 0;
    
    // Free tier limit: 3 community uploads per month
    const maxFreeUploads = 3;
    const uploadsLeft = isSupporter ? Infinity : Math.max(0, maxFreeUploads - uploadsThisMonth);
    
    // Cloud storage limit for supporters
    const cloudMaxBytes = 500 * 1024 * 1024; // 500 MB
    const cloudUsedBytes = profile?.cloud_used_bytes || 0;

    return {
        profile,
        loading,
        tier: profile?.tier || 'free',
        isSupporter,
        uploadsThisMonth,
        uploadsLeft,
        cloudUsedBytes,
        cloudMaxBytes,
        refreshProfile: async () => {
            const p = await getUserProfile();
            if (p) setProfile(p);
        }
    };
}
