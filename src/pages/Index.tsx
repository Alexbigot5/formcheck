import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-smartforms.png";
import FeatureCard from "@/components/FeatureCard";
import { Bot, LineChart, Plug } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import heroImage from "@/assets/hero-smartforms.png";
// import { Bot, LineChart, Plug } from "lucide-react";

const Index = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SmartForms AI",
    applicationCategory: "BusinessApplication",
    description:
      "SmartForms AI builds dynamic forms, scores leads automatically, and syncs with your CRM.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div>
      <Header />
      <div style={{ minHeight: '60vh', backgroundColor: '#f7f7fb', padding: '32px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gap: '32px', gridTemplateColumns: '1fr', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700, marginBottom: '16px', color: '#222' }}>
              SmartForms AI
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '24px' }}>
              Build dynamic forms, score leads automatically, and sync with your CRM.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button asChild>
                <a href="#signup">Get Started</a>
              </Button>
              <Button asChild variant="secondary">
                <a href="/register">Log in / Sign up</a>
              </Button>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <img src={heroImage} alt="SmartForms AI dashboard" style={{ maxWidth: '100%', borderRadius: '12px', border: '1px solid #e5e7eb' }} />
          </div>
        </div>
      </div>
      {/* Features */}
      <div style={{ padding: '32px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', marginBottom: '12px' }}>Key features</h2>
          <p style={{ color: '#6b7280', textAlign: 'center', marginBottom: '24px' }}>
            Everything you need to launch high-converting forms and route the right leads to your team.
          </p>
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <FeatureCard icon={Bot} title="Dynamic forms" description="Conditional logic, AI field suggestions, and real-time previews help you ship smarter forms faster." />
            <FeatureCard icon={LineChart} title="Lead scoring" description="Automatic scoring based on responses and behavior to surface high-intent prospects." />
            <FeatureCard icon={Plug} title="CRM integrations" description="Instant sync with your favorite tools and CRMs to keep your pipeline up to date." />
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div style={{ padding: '32px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginBottom: 12, fontWeight: 600, color: '#991b1b' }}>Traditional Form + Zapier Stack</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#b91c1c' }}>Speed to first reply</span>
                <strong>24-48 hours</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#b91c1c' }}>Missed leads</span>
                <strong>30-40%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#b91c1c' }}>Manual steps per lead</span>
                <strong>8-12 steps</strong>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c' }}>Multiple tools, complex workflows, manual lead qualification</div>
          </div>
          <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginBottom: 12, fontWeight: 600, color: '#166534' }}>SmartForms AI Platform</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#16a34a' }}>Speed to first reply</span>
                <strong>Under 5 minutes</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#16a34a' }}>Missed leads</span>
                <strong>Less than 5%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#16a34a' }}>Manual steps per lead</span>
                <strong>0-1 steps</strong>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a' }}>All-in-one platform with AI-powered automation</div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div style={{ padding: '32px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ margin: '0 auto 12px', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: '#dbeafe', color: '#2563eb', fontWeight: 700 }}>10x</div>
            <h4 style={{ fontWeight: 600 }}>Faster Response</h4>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Instant lead qualification and routing vs manual review</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ margin: '0 auto 12px', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: '#dcfce7', color: '#16a34a', fontWeight: 700 }}>85%</div>
            <h4 style={{ fontWeight: 600 }}>Fewer Missed Leads</h4>
            <p style={{ color: '#6b7280', fontSize: 14 }}>AI-powered scoring catches qualified leads that slip through cracks</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ margin: '0 auto 12px', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: '#ede9fe', color: '#7c3aed', fontWeight: 700 }}>90%</div>
            <h4 style={{ fontWeight: 600 }}>Less Manual Work</h4>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Automated workflows eliminate repetitive tasks and human error</p>
          </div>
        </div>
      </div>

      {/* Hidden CTA anchors */}
      <section id="signup" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)' }} aria-hidden="true" />
      <section id="demo" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)' }} aria-hidden="true" />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </div>
  );
};

export default Index;

