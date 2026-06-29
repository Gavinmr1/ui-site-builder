import { nanoid } from './nanoid';
import type { EditorNode } from '../types';

export function createSampleWebsite(): EditorNode[] {
  const id = (prefix: string) => `${prefix}_${nanoid()}`;

  return [
    // Header/Navigation
    {
      id: id('header'),
      type: 'section',
      props: {},
      styles: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 32px',
        backgroundColor: '#1a1a2e',
        borderBottom: '1px solid #16213e',
        gap: '24px',
      },
      children: [
        {
          id: id('logo'),
          type: 'heading',
          props: { text: 'BuilderHub' },
          styles: {
            fontSize: '28px',
            fontWeight: '700',
            color: '#00d4ff',
          },
          children: [],
        },
        {
          id: id('nav-links'),
          type: 'flex-row',
          props: {},
          styles: {
            display: 'flex',
            flexDirection: 'row',
            gap: '32px',
            flex: '1',
          },
          children: [
            {
              id: id('nav-1'),
              type: 'paragraph',
              props: { text: 'Features' },
              styles: { color: '#eee', cursor: 'pointer', fontSize: '14px' },
              children: [],
            },
            {
              id: id('nav-2'),
              type: 'paragraph',
              props: { text: 'Pricing' },
              styles: { color: '#eee', cursor: 'pointer', fontSize: '14px' },
              children: [],
            },
            {
              id: id('nav-3'),
              type: 'paragraph',
              props: { text: 'Docs' },
              styles: { color: '#eee', cursor: 'pointer', fontSize: '14px' },
              children: [],
            },
          ],
        },
        {
          id: id('cta-btn'),
          type: 'button',
          props: { text: 'Sign Up' },
          styles: {
            padding: '10px 24px',
            backgroundColor: '#00d4ff',
            color: '#1a1a2e',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '14px',
          },
          children: [],
        },
      ],
    },

    // Hero Section
    {
      id: id('hero'),
      type: 'section',
      props: {},
      styles: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 40px',
        backgroundColor: '#0f3460',
        textAlign: 'center',
        gap: '24px',
        minHeight: '500px',
      },
      children: [
        {
          id: id('hero-title'),
          type: 'heading',
          props: { text: 'Build Websites Without Code' },
          styles: {
            fontSize: '48px',
            fontWeight: '700',
            color: '#00d4ff',
            lineHeight: '1.2',
            maxWidth: '800px',
          },
          children: [],
        },
        {
          id: id('hero-subtitle'),
          type: 'paragraph',
          props: { text: 'Drag, drop, and design. No coding skills required. Deploy instantly.' },
          styles: {
            fontSize: '18px',
            color: '#ccc',
            maxWidth: '600px',
            lineHeight: '1.6',
          },
          children: [],
        },
        {
          id: id('hero-button'),
          type: 'button',
          props: { text: 'Get Started Free' },
          styles: {
            padding: '16px 40px',
            backgroundColor: '#00d4ff',
            color: '#1a1a2e',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '700',
            fontSize: '16px',
            cursor: 'pointer',
            marginTop: '16px',
          },
          children: [],
        },
      ],
    },

    // Features Section
    {
      id: id('features-section'),
      type: 'section',
      props: {},
      styles: {
        padding: '80px 40px',
        backgroundColor: '#1a1a2e',
      },
      children: [
        {
          id: id('features-title'),
          type: 'heading',
          props: { text: 'Powerful Features' },
          styles: {
            fontSize: '36px',
            fontWeight: '700',
            color: '#00d4ff',
            textAlign: 'center',
            marginBottom: '60px',
          },
          children: [],
        },
        {
          id: id('features-grid'),
          type: 'grid',
          props: {},
          styles: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '32px',
            maxWidth: '1200px',
            margin: '0 auto',
          },
          children: [
            // Feature 1
            {
              id: id('feature-card-1'),
              type: 'container',
              props: {},
              styles: {
                padding: '32px 24px',
                backgroundColor: '#16213e',
                borderRadius: '8px',
                border: '1px solid #0f3460',
              },
              children: [
                {
                  id: id('feature-icon-1'),
                  type: 'heading',
                  props: { text: '⚡' },
                  styles: { fontSize: '32px', marginBottom: '16px' },
                  children: [],
                },
                {
                  id: id('feature-title-1'),
                  type: 'heading',
                  props: { text: 'Lightning Fast' },
                  styles: {
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#00d4ff',
                    marginBottom: '12px',
                  },
                  children: [],
                },
                {
                  id: id('feature-desc-1'),
                  type: 'paragraph',
                  props: { text: 'Build and deploy websites in minutes, not days. Optimized performance out of the box.' },
                  styles: { fontSize: '14px', color: '#aaa', lineHeight: '1.6' },
                  children: [],
                },
              ],
            },

            // Feature 2
            {
              id: id('feature-card-2'),
              type: 'container',
              props: {},
              styles: {
                padding: '32px 24px',
                backgroundColor: '#16213e',
                borderRadius: '8px',
                border: '1px solid #0f3460',
              },
              children: [
                {
                  id: id('feature-icon-2'),
                  type: 'heading',
                  props: { text: '🎨' },
                  styles: { fontSize: '32px', marginBottom: '16px' },
                  children: [],
                },
                {
                  id: id('feature-title-2'),
                  type: 'heading',
                  props: { text: 'Fully Customizable' },
                  styles: {
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#00d4ff',
                    marginBottom: '12px',
                  },
                  children: [],
                },
                {
                  id: id('feature-desc-2'),
                  type: 'paragraph',
                  props: { text: 'Full control over every pixel. Responsive design, animations, and advanced styling.' },
                  styles: { fontSize: '14px', color: '#aaa', lineHeight: '1.6' },
                  children: [],
                },
              ],
            },

            // Feature 3
            {
              id: id('feature-card-3'),
              type: 'container',
              props: {},
              styles: {
                padding: '32px 24px',
                backgroundColor: '#16213e',
                borderRadius: '8px',
                border: '1px solid #0f3460',
              },
              children: [
                {
                  id: id('feature-icon-3'),
                  type: 'heading',
                  props: { text: '🚀' },
                  styles: { fontSize: '32px', marginBottom: '16px' },
                  children: [],
                },
                {
                  id: id('feature-title-3'),
                  type: 'heading',
                  props: { text: 'One Click Deploy' },
                  styles: {
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#00d4ff',
                    marginBottom: '12px',
                  },
                  children: [],
                },
                {
                  id: id('feature-desc-3'),
                  type: 'paragraph',
                  props: { text: 'Deploy to production with a single click. Built-in CDN, SSL, and analytics.' },
                  styles: { fontSize: '14px', color: '#aaa', lineHeight: '1.6' },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },

    // CTA Section
    {
      id: id('cta-section'),
      type: 'section',
      props: {},
      styles: {
        padding: '60px 40px',
        backgroundColor: '#0f3460',
        textAlign: 'center',
      },
      children: [
        {
          id: id('cta-title'),
          type: 'heading',
          props: { text: 'Ready to Build Something Amazing?' },
          styles: {
            fontSize: '32px',
            fontWeight: '700',
            color: '#00d4ff',
            marginBottom: '24px',
          },
          children: [],
        },
        {
          id: id('cta-final-button'),
          type: 'button',
          props: { text: 'Start Building Now' },
          styles: {
            padding: '14px 36px',
            backgroundColor: '#00d4ff',
            color: '#1a1a2e',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '700',
            fontSize: '16px',
            cursor: 'pointer',
          },
          children: [],
        },
      ],
    },

    // Footer
    {
      id: id('footer'),
      type: 'section',
      props: {},
      styles: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '32px 40px',
        backgroundColor: '#16213e',
        borderTop: '1px solid #0f3460',
      },
      children: [
        {
          id: id('footer-text'),
          type: 'paragraph',
          props: { text: '© 2026 BuilderHub. All rights reserved.' },
          styles: { color: '#888', fontSize: '14px' },
          children: [],
        },
        {
          id: id('footer-links'),
          type: 'flex-row',
          props: {},
          styles: {
            display: 'flex',
            flexDirection: 'row',
            gap: '24px',
          },
          children: [
            {
              id: id('footer-link-1'),
              type: 'paragraph',
              props: { text: 'Privacy' },
              styles: { color: '#00d4ff', cursor: 'pointer', fontSize: '14px' },
              children: [],
            },
            {
              id: id('footer-link-2'),
              type: 'paragraph',
              props: { text: 'Terms' },
              styles: { color: '#00d4ff', cursor: 'pointer', fontSize: '14px' },
              children: [],
            },
            {
              id: id('footer-link-3'),
              type: 'paragraph',
              props: { text: 'Contact' },
              styles: { color: '#00d4ff', cursor: 'pointer', fontSize: '14px' },
              children: [],
            },
          ],
        },
      ],
    },
  ];
}
