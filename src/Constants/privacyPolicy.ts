export interface PrivacyPolicySection {
  id: string;
  title: string;
  summary?: string;
  bullets: string[];
}

export const PRIVACY_POLICY_EFFECTIVE_DATE = 'November 24, 2026';

export const PRIVACY_POLICY_INTRO =
  'My Spare Zone ("we", "our", or "us") operates from Seventies Plaza, Kirinyaga Road, Nairobi, Kenya, providing genuine OEM and aftermarket automotive spare parts, in-garage fitting services, and nationwide delivery. This Privacy Policy explains how we collect, use, store, share, and protect your personal information when you use our storefront, web app, or mobile app in compliance with the Kenya Data Protection Act, 2019 and applicable store data safety standards.';

export const PRIVACY_POLICY_SECTIONS: PrivacyPolicySection[] = [
  {
    id: 'information-we-collect',
    title: '1. Information We Collect',
    summary:
      'We collect only the information needed to identify your account, match compatible vehicle parts, process payments, deliver orders, and provide customer support.',
    bullets: [
      'Account & Identity Information: Full name, Kenyan or international mobile phone number, and email address entered during sign-in. Your full name is synced directly with your Customer Care chats and printed on your VirtualReceipts.',
      'Optional Vehicle Fitment Profile: Car brand, car model, and year of make you voluntarily save to filter and highlight compatible spare parts.',
      'Order, Delivery & Appointment Data: Delivery address or destination in Kenya, selected courier service, Counter Pickup reservation codes, In-Garage Fitting vehicle details and appointment slots, and assigned Nairobi rider details.',
      'Payment & Verification Records: M-Pesa phone number and M-Pesa transaction confirmation code entered during checkout validation, or masked card details (card brand, last 4 digits, and authorization reference). We never store M-Pesa PINs or card CVV security codes.',
      'Communications, Bargains & Activity: Messages exchanged in Customer Care Chat, price bargain offers, product reviews, wishlist selections, and part search queries.',
      'Essential Device & Session Storage: A browser session identifier, authentication token, shopping cart items, recently viewed parts, and optional browser notification preferences.',
    ],
  },
  {
    id: 'how-we-use-information',
    title: '2. How We Use Your Information',
    bullets: [
      'Order Processing & VirtualReceipts: To verify M-Pesa or card payments, reserve Counter Pickup stock, generate VirtualReceipts, and administer our 7-day purchase guarantee, returns, and free exchanges.',
      'Automated SMS & Live WhatsApp Delivery Updates: To send automated order and fitting status SMS alerts from our shop phone number (+254706130014 or our configured admin dispatch line), and to coordinate Nairobi deliveries where our rider shares their live location, photo, and number plate from their WhatsApp to your WhatsApp.',
      'Customer Care & Price Negotiations: To respond accurately to spare part inquiries in live chat, negotiate and honor agreed bargain offers, and link approved Garage or Mechanic Partner discounts and referral credits.',
      'Inventory & Fitment Relevance: To monitor commonly searched spare parts and help you quickly locate components matching your saved car model and year of make.',
    ],
  },
  {
    id: 'data-sharing',
    title: '3. How & When Information Is Shared',
    summary:
      'We do not sell, rent, or trade your personal information or purchase history to third-party advertisers or data brokers.',
    bullets: [
      'Payment Processors: M-Pesa STK Push and payment verification requests are transmitted securely to Safaricom Daraja / payment gateway endpoints solely to authorize and confirm your purchase.',
      'Delivery Riders & Intercity Couriers: Your name, phone number, and delivery destination are shared with our assigned Nairobi delivery rider (for WhatsApp live-location handoff) or your chosen courier company for deliveries outside Nairobi.',
      'SMS Notification Providers: Your mobile number and order status message are sent through our configured SMS dispatch channel strictly for transactional order and garage bay notifications.',
      'Legal & Accounting Compliance: Transaction receipts and tax/bookkeeping records may be retained or disclosed where required by Kenyan law, tax authorities, or fraud-prevention investigations.',
    ],
  },
  {
    id: 'data-security-retention',
    title: '4. Data Security & Retention',
    bullets: [
      'Transport & Access Controls: Sessions require authenticated tokens, administrative dashboards and exports are restricted to verified administrator accounts, and sensitive payment credentials (M-Pesa PINs, card CVVs) are never persisted on our servers.',
      'Retention Period: Order receipts, M-Pesa transaction references, and accounting logs are retained for statutory bookkeeping and warranty verification. Temporary M-Pesa checkout prompts and expired session tokens are periodically pruned.',
      'Local Browser Data: You can clear your saved vehicle profile, wishlist, recently viewed history, or sign out at any time directly within the app.',
    ],
  },
  {
    id: 'your-rights',
    title: '5. Your Privacy Rights (Kenya Data Protection Act, 2019)',
    bullets: [
      'Access & Correction: You may view your account profile, order history, VirtualReceipts, and bargains in the app, and request correction of any inaccurate contact or order details.',
      'Consent & Notifications: Saving your car model/year and enabling browser chat alerts are completely optional and can be cleared or turned off anytime.',
      'Deletion Requests: You may request deletion of your account profile and chat history (subject to mandatory financial and tax receipt retention obligations) by contacting Customer Care.',
    ],
  },
  {
    id: 'contact-updates',
    title: '6. Policy Updates & Contact Us',
    bullets: [
      'Physical Shop: My Spare Zone, Seventies Plaza, Kirinyaga Road, Nairobi, Kenya (Mon–Sat, 8:00 AM – 6:00 PM).',
      'Customer Care Phone & WhatsApp: +254706130014.',
      'Policy Changes: If we update this Privacy Policy, we will post the revised effective date here and in the storefront Privacy Policy view.',
    ],
  },
];
