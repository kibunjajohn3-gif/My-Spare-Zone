import { useEffect } from 'react';
import type { CarBrand, PrimaryCategory, SparePart } from '../types';
import { CUSTOMER_CARE_NUMBER, SHOP_NAME } from '../constants/catalog';
import type { ActivePage } from './TopBar';

interface SeoMetadataProps {
  activePage: ActivePage;
  selectedCategory: 'All' | PrimaryCategory;
  selectedSubcategory: string;
  selectedBrand: 'All' | CarBrand;
  inspectedPart: SparePart | null;
}

const DEFAULT_TITLE = `${SHOP_NAME} — Genuine Automotive Spare Parts`;
const DEFAULT_DESCRIPTION =
  'Shop genuine body parts, electricals, gearboxes, gearbox oil, and interior parts at My Spare Zone. 7-day guarantee & fast Kenya delivery.';
const DEFAULT_IMAGE = '/pwa-512x512.png';

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertDynamicJsonLd(payload: Record<string, unknown>) {
  const id = 'dynamic-seo-jsonld';
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

export function SeoMetadata({
  activePage,
  selectedCategory,
  selectedSubcategory,
  selectedBrand,
  inspectedPart,
}: SeoMetadataProps) {
  useEffect(() => {
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    const toAbsoluteUrl = (pathOrUrl: string) => {
      if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
      return `${window.location.origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
    };

    let title = DEFAULT_TITLE;
    let description = DEFAULT_DESCRIPTION;
    let image = toAbsoluteUrl(DEFAULT_IMAGE);
    let jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SHOP_NAME,
      url: canonicalUrl,
      description: DEFAULT_DESCRIPTION,
      publisher: {
        '@type': 'AutoPartsStore',
        name: SHOP_NAME,
        telephone: CUSTOMER_CARE_NUMBER,
      },
    };

    if (inspectedPart) {
      const brandPrefix =
        inspectedPart.brand && inspectedPart.brand !== 'Universal' ? `${inspectedPart.brand} ` : '';
      title = `${inspectedPart.name} | ${SHOP_NAME}`;
      description = `${brandPrefix}${inspectedPart.category} (${inspectedPart.subcategory}) — ${inspectedPart.description.slice(0, 115)}`;
      image = toAbsoluteUrl(inspectedPart.imageUrl || DEFAULT_IMAGE);
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: inspectedPart.name,
        description: inspectedPart.description,
        sku: inspectedPart.sku,
        category: `${inspectedPart.category} > ${inspectedPart.subcategory}`,
        image,
        brand: {
          '@type': 'Brand',
          name: inspectedPart.brand || 'OEM',
        },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: 'KES',
          price: inspectedPart.price,
          availability:
            inspectedPart.stock > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/PreOrder',
          seller: {
            '@type': 'AutoPartsStore',
            name: SHOP_NAME,
            telephone: CUSTOMER_CARE_NUMBER,
          },
        },
      };
    } else if (activePage === 'orders') {
      title = `Order History & Virtual Receipts | ${SHOP_NAME}`;
      description =
        'Track your spare part order status (Pending, Shipped, Delivered) and view printable virtual receipts at My Spare Zone.';
    } else if (activePage === 'partner') {
      title = `Garage & Mechanic Partner Portal | ${SHOP_NAME}`;
      description =
        'Track exclusive Garage & Mechanic bulk spare part pricing, order history, referral savings, and direct trade desk contacts at My Spare Zone.';
    } else if (activePage === 'admin') {
      title = `Admin Console | ${SHOP_NAME}`;
      description =
        'Manage spare part inventory, weekly sales reports, receipt history, and live customer chats at My Spare Zone.';
    } else if (selectedCategory !== 'All') {
      const parts: string[] = [];
      if (selectedBrand !== 'All') parts.push(selectedBrand);
      if (selectedSubcategory !== 'All') {
        parts.push(selectedSubcategory);
      } else {
        parts.push(selectedCategory);
      }
      const label = parts.join(' ');
      title = `${label} Spare Parts | ${SHOP_NAME}`;
      description = `Browse genuine ${label.toLowerCase()} spare parts at ${SHOP_NAME}. Verified quality, 7-day purchase guarantee, and fast delivery across Kenya.`;
    }

    document.title = title;
    upsertCanonicalLink(canonicalUrl);
    upsertMetaTag('name', 'description', description);
    upsertMetaTag('property', 'og:url', canonicalUrl);
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('property', 'og:image', image);
    upsertMetaTag('name', 'twitter:title', title);
    upsertMetaTag('name', 'twitter:description', description);
    upsertMetaTag('name', 'twitter:image', image);
    upsertDynamicJsonLd(jsonLd);
  }, [activePage, selectedCategory, selectedSubcategory, selectedBrand, inspectedPart]);

  return null;
}
