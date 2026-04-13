import { create } from 'zustand';

type SubscriptionTier = 'free' | 'premium';

interface SubscriptionState {
  tier: SubscriptionTier;
  setTier: (tier: SubscriptionTier) => void;
  isPremium: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  setTier: (tier) => set({ tier }),
  isPremium: () => get().tier === 'premium',
}));
