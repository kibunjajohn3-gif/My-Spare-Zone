import { SHOP_NAME } from '../constants/catalog';

export type BrandWordmarkSize = 'header' | 'hero' | 'footer' | 'receipt';

interface BrandWordmarkProps {
  size?: BrandWordmarkSize;
  name?: string;
  showStripe?: boolean;
  className?: string;
}

const SIZE_STYLES: Record<
  BrandWordmarkSize,
  {
    wrapper: string;
    icon: string;
    text: string;
    stripe: string;
  }
> = {
  header: {
    wrapper: 'gap-2.5 sm:gap-3',
    icon: 'w-8 h-8 sm:w-10 sm:h-10',
    text: 'text-2xl sm:text-[1.85rem]',
    stripe: 'h-[3px] mt-0.5',
  },
  hero: {
    wrapper: 'gap-3',
    icon: 'w-10 h-10 sm:w-12 sm:h-12',
    text: 'text-3xl sm:text-4xl',
    stripe: 'h-1 mt-1',
  },
  footer: {
    wrapper: 'gap-2.5',
    icon: 'w-8 h-8',
    text: 'text-xl sm:text-2xl',
    stripe: 'h-[3px] mt-0.5',
  },
  receipt: {
    wrapper: 'gap-2.5 justify-center',
    icon: 'w-8 h-8 sm:w-10 sm:h-10',
    text: 'text-2xl sm:text-3xl',
    stripe: 'h-[3px] mt-1',
  },
};

export function BrandWordmark({
  size = 'header',
  name = SHOP_NAME,
  showStripe = true,
  className = '',
}: BrandWordmarkProps) {
  const styles = SIZE_STYLES[size];
  const words = name.trim().split(/\s+/);
  const isDefaultThreeWordBrand = words.length === 3;

  return (
    <span className={`inline-flex items-center ${styles.wrapper} ${className}`}>
      {/* Spare Parts Picture Icon */}
      <img
        src="/pwa-192x192.png"
        alt=""
        aria-hidden="true"
        className={`${styles.icon} rounded-xl object-cover shrink-0 shadow-xs ring-1 ring-slate-900/15`}
      />

      {/* Bold, Colorful Multi-Tone Automotive Wordmark */}
      <span className="inline-flex flex-col leading-none">
        <span
          className={`font-display font-black tracking-tight whitespace-nowrap ${styles.text}`}
        >
          {isDefaultThreeWordBrand ? (
            <>
              <span className="text-slate-900">{words[0]} </span>
              <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 bg-clip-text text-transparent">
                {words[1]}{' '}
              </span>
              <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                {words[2]}
              </span>
            </>
          ) : (
            <span className="bg-gradient-to-r from-slate-900 via-orange-600 to-blue-700 bg-clip-text text-transparent">
              {name}
            </span>
          )}
        </span>
        {showStripe && (
          <span
            aria-hidden="true"
            className={`w-full rounded-full bg-gradient-to-r from-slate-900 via-orange-500 via-55% to-blue-600 ${styles.stripe}`}
          />
        )}
      </span>
    </span>
  );
}
