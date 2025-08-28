import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface TemplateRow {
  id: string;
  segment: string;
  subject: string;
  updated_at: string;
}

const SavedEmailTemplates: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SEO
    document.title = "Saved Email Templates | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Browse and manage your saved email templates by segment.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/email-templates/saved`);

    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) navigate("/login");
    }).data.subscription;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return navigate("/login");
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, segment, subject, updated_at")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false });
      if (!error && data) setRows(data as TemplateRow[]);
      setLoading(false);
    });

    return () => sub.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <section className="container mx-auto px-4 py-10">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Saved Email Templates</h1>
            <p className="text-muted-foreground mt-1">All templates you have saved per segment.</p>
            <div className="mt-3">
              <Button variant="outline" onClick={() => navigate("/email-templates")}>Back to editor</Button>
            </div>
          </header>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading templates…</div>
          ) : rows.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No templates yet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Click Save in the editor to create your first template.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <Card key={r.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="capitalize">{r.segment}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/email-templates?segment=${encodeURIComponent(r.segment)}`)}
                      >
                        Edit
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Subject</Label>
                      <div className="truncate" title={r.subject}>{r.subject}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {new Date(r.updated_at).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default SavedEmailTemplates;
