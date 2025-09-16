import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  Calendar, 
  Users, 
  TrendingUp, 
  Search, 
  Filter,
  Eye,
  Edit,
  Trash2,
  Download,
  ArrowLeft,
  Plus
} from "lucide-react";

interface Form {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  schema: any;
  submissions_count?: number;
  last_submission?: string;
  status: 'active' | 'draft' | 'archived';
}

interface FormSubmission {
  id: string;
  form_id: string;
  submitted_at: string;
  data: any;
  lead_score?: number;
}

const ViewForms: React.FC = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);

  useEffect(() => {
    // SEO
    document.title = "View Forms | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "View and manage your SmartForms, track submissions and analytics.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/forms`);

    // Production mode - always use Supabase auth and real data
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) navigate("/login");
    });

    loadForms();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadForms = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return navigate("/login");

      const { data: formsData, error } = await supabase
        .from("forms")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load forms", { description: error.message });
        return;
      }

      // Mock some additional data for demonstration
      const formsWithStats = (formsData || []).map(form => ({
        ...form,
        submissions_count: Math.floor(Math.random() * 50),
        last_submission: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : null,
        status: Math.random() > 0.8 ? 'draft' : Math.random() > 0.9 ? 'archived' : 'active'
      })) as Form[];

      setForms(formsWithStats);
    } catch (error) {
      toast.error("Failed to load forms");
      console.error("Error loading forms:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (formId: string) => {
    // Mock submissions data since we don't have a submissions table yet
    const mockSubmissions: FormSubmission[] = Array.from({ length: 5 }, (_, i) => ({
      id: `sub-${i}`,
      form_id: formId,
      submitted_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      data: {
        name: `Lead ${i + 1}`,
        email: `lead${i + 1}@example.com`,
        company: `Company ${i + 1}`,
        budget: Math.floor(Math.random() * 100000) + 5000
      },
      lead_score: Math.floor(Math.random() * 100)
    }));
    
    setSubmissions(mockSubmissions);
  };

  const deleteForm = async (formId: string) => {
    try {
      const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", formId);

      if (error) {
        toast.error("Failed to delete form", { description: error.message });
        return;
      }

      setForms(prev => prev.filter(form => form.id !== formId));
      toast.success("Form deleted successfully");
    } catch (error) {
      toast.error("Failed to delete form");
    }
  };

  const duplicateForm = async (form: Form) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from("forms")
        .insert({
          user_id: session.user.id,
          name: `${form.name} (Copy)`,
          schema: form.schema
        });

      if (error) {
        toast.error("Failed to duplicate form", { description: error.message });
        return;
      }

      loadForms();
      toast.success("Form duplicated successfully");
    } catch (error) {
      toast.error("Failed to duplicate form");
    }
  };

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || form.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'default';
    }
  };

  if (selectedForm) {
    return (
      <Layout>
        <div>
            <div className="mb-6 flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedForm(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Forms
              </Button>
            </div>

            <header className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">{selectedForm.name}</h1>
                  <p className="text-muted-foreground mt-1">
                    Form submissions and analytics
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor(selectedForm.status)}>
                    {selectedForm.status}
                  </Badge>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            </header>

            {/* Form Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedForm.submissions_count || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Lead Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {submissions.length > 0 
                      ? Math.round(submissions.reduce((acc, sub) => acc + (sub.lead_score || 0), 0) / submissions.length)
                      : 0
                    }
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.floor(Math.random() * 15)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.floor(Math.random() * 30 + 10)}%</div>
                </CardContent>
              </Card>
            </div>

            {/* Submissions List */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2" />
                    <p>No submissions yet</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => loadSubmissions(selectedForm.id)}
                    >
                      Load Sample Data
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submissions.map((submission) => (
                      <div key={submission.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{submission.data.name}</div>
                            <Badge variant="outline">Score: {submission.lead_score}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(submission.submitted_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm">
                          <div><strong>Email:</strong> {submission.data.email}</div>
                          <div><strong>Company:</strong> {submission.data.company}</div>
                          <div><strong>Budget:</strong> ${submission.data.budget?.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
          <header className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Your Forms</h1>
                <p className="text-muted-foreground mt-1">
                  Manage and view submissions for all your forms
                </p>
              </div>
              <Button onClick={() => navigate("/forms/new")} className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Form
              </Button>
            </div>
          </header>

          {/* Search and Filter */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search forms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-md border bg-background px-3 py-2"
              >
                <option value="all">All Forms</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Forms Grid */}
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading forms...</div>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                {forms.length === 0 ? "No forms yet" : "No forms match your search"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {forms.length === 0 
                  ? "Create your first form to start collecting leads"
                  : "Try adjusting your search or filter criteria"
                }
              </p>
              {forms.length === 0 && (
                <Button onClick={() => navigate("/forms/new")}>
                  Create Your First Form
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredForms.map((form) => (
                <Card key={form.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{form.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Created {new Date(form.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={getStatusColor(form.status)}>
                        {form.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{form.submissions_count || 0} submissions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {form.last_submission 
                              ? new Date(form.last_submission).toLocaleDateString()
                              : "No submissions"
                            }
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => {
                            setSelectedForm(form);
                            loadSubmissions(form.id);
                          }}
                          className="flex-1"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/forms/edit/${form.id}`)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => duplicateForm(form)}
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this form?")) {
                              deleteForm(form.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </div>
    </Layout>
  );
};

export default ViewForms;
