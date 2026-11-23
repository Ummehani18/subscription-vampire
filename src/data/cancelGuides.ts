export interface CancelGuide {
  /** Short, neutral steps, paraphrased from the provider's own help page. */
  steps: string[];
  /** The provider help page the steps were checked against. */
  url?: string;
  /** 'YYYY-MM-DD' the steps were last checked against `url`. */
  lastVerified: string;
}

/** Shown with every guide, merchant-specific or generic (Req 7.3). */
export const VERIFY_NOTE = 'Verify in your app, steps may have changed';

/**
 * Cancellation steps keyed by canonical merchant name (the alias table's
 * `canonical`). Only merchants whose steps were checked on the provider's own
 * help page are listed; every other merchant gets `genericGuide`.
 *
 * Checked on 2026-11-22. Not listed because no usable provider page was found:
 * Google One (steps not readable on its help page), JioHotstar (no provider
 * page found), Cult.fit (provider pages say active packs cannot be cancelled),
 * Jio and Airtel (no provider page found).
 */
export const CANCEL_GUIDES: Readonly<Record<string, CancelGuide>> = {
  Netflix: {
    steps: [
      'Open the "Manage your membership" page on Netflix and sign in if asked.',
      'Select Cancel.',
      'Select Finish Cancellation. Netflix sends a confirmation email.',
      'Signing out or deleting the Netflix app does not cancel the membership.',
    ],
    url: 'https://help.netflix.com/en/node/407',
    lastVerified: '2026-11-22',
  },
  Spotify: {
    steps: [
      'Open your Spotify account page.',
      'Select Cancel plan, under "Your plan" or "Manage your plan".',
      'Continue to the confirmation message. Premium stays until your next billing date.',
      'If a partner such as your mobile provider bills the plan, cancel through that partner.',
    ],
    url: 'https://support.spotify.com/in-en/article/cancel-premium/',
    lastVerified: '2026-11-22',
  },
  'YouTube Premium': {
    steps: [
      'In YouTube, tap your profile picture, then Paid memberships.',
      'Tap the membership, then Continue to cancel.',
      'Choose a reason, tap Next, then Yes, cancel.',
      'If Apple or Google Play bills the membership, cancel it in that store instead.',
    ],
    url: 'https://support.google.com/youtube/answer/6308278',
    lastVerified: '2026-11-22',
  },
  ChatGPT: {
    steps: [
      'Sign in to chatgpt.com.',
      'Open your account menu, then Settings, then Billing.',
      'Under Cancel plan, select Cancel.',
      'If you subscribed through the Apple App Store or Google Play, cancel in that store. Uninstalling the app does not cancel.',
    ],
    url: 'https://help.openai.com/en/articles/7232927-how-do-i-cancel-my-chatgpt-plus-subscription',
    lastVerified: '2026-11-22',
  },
  'Sony LIV': {
    steps: [
      'If you paid by card, UPI or wallet, open My Purchases in Sony LIV.',
      'Select Cancel, choose a reason and submit.',
      'If Google Play, Apple or Amazon bills you, cancel in that store\'s subscriptions instead.',
    ],
    url: 'https://help.sonyliv.com/categories/cat-subscription/articles/how-can-i-cancel-my-subscription',
    lastVerified: '2026-11-22',
  },
};

/** Steps for any merchant without a verified guide (Req 7.2). */
export const genericGuide: { steps: string[] } = {
  steps: [
    "Cancel the subscription in the merchant's app or website.",
    'Revoke the UPI AutoPay mandate in your UPI app.',
    'If you pay by card, remove the card e-mandate.',
    'If charges continue, contact your bank.',
  ],
};

export type ResolvedGuide = { kind: 'merchant'; guide: CancelGuide } | { kind: 'generic'; steps: string[] };

/** The verified guide for a merchant display name, or the generic steps. */
export function guideFor(merchant: string): ResolvedGuide {
  const guide = Object.hasOwn(CANCEL_GUIDES, merchant) ? CANCEL_GUIDES[merchant] : undefined;
  return guide ? { kind: 'merchant', guide } : { kind: 'generic', steps: genericGuide.steps };
}
