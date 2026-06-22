import React from 'react';
import PricingModal from '@/components/PricingModal';

/**
 * UpgradeModal — thin wrapper around PricingModal.
 * Kept for backwards compat (SettingsPanel imports this).
 */
export default function UpgradeModal({ onClose, userId }) {
    return <PricingModal open onClose={onClose} userId={userId} />;
}
