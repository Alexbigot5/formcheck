import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const leadScoringSchema = z.object({
  emailDomainMatch: z.number().min(0).max(100).default(20),
  jobSeniority: z.number().min(0).max(100).default(30),
  companySize: z.number().min(0).max(100).default(10),
});

type LeadScoring = z.infer<typeof leadScoringSchema>;

const formSchema = z.object({
  formName: z.string().min(2, "Form name is required"),
  leadScoring: leadScoringSchema,
  crmProvider: z.enum(["hubspot", "salesforce"]).optional(),
});

type OnboardingValues = z.infer<typeof formSchema>;

const steps = [
  { id: 1, title: "Create your first form" },
  { id: 2, title: "Define lead scoring" },
  { id: 3, title: "Connect your CRM" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const progress = useMemo(() => (step / steps.length) * 100, [step]);

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      formName: "",
      leadScoring: {
        emailDomainMatch: 20,
        jobSeniority: 30,
        companySize: 10,
      },
      crmProvider: undefined,
    },
    mode: "onBlur",
  });

  useEffect(() => {
    // SEO
    document.title = "Onboarding | SmartForms AI";
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute(
      "content",
      "Get started with SmartForms AI: create your first form, set lead scoring, and connect your CRM."
    );
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/onboarding`);

    // Auth + profile guard
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) navigate("/login");
        // Avoid extra Supabase calls directly here per best practices
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return navigate("/login");
      // Check onboarding status
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_step, first_form_name, lead_scoring, crm_provider, crm_connected")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        // Not fatal; allow onboarding to proceed
        console.warn("Failed to load profile", error);
        return;
      }

      if (data?.onboarding_completed) {
        navigate("/dashboard");
      } else if (data?.onboarding_step && data.onboarding_step >= 1 && data.onboarding_step <= steps.length) {
        setStep(data.onboarding_step);
        if (data.first_form_name) form.setValue("formName", data.first_form_name);
        if (data.lead_scoring) form.setValue("leadScoring", data.lead_scoring as LeadScoring);
        if (data.crm_provider) form.setValue("crmProvider", data.crm_provider as "hubspot" | "salesforce");
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const saveStep = async (nextStep?: number) => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        navigate("/login");
        return;
      }

      const values = form.getValues();
      const payload: Record<string, any> = {
        onboarding_step: nextStep ?? step,
      };

      if (step === 1) {
        payload.first_form_name = values.formName;
      }
      if (step === 2) {
        payload.lead_scoring = values.leadScoring;
      }
      if (step === 3) {
        payload.crm_provider = values.crmProvider ?? null;
        // we'll mark crm_connected later when real OAuth is added
      }

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Progress saved");
    } catch (e: any) {
      toast.error("Couldn't save your progress", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    const valid = await form.trigger(step === 1 ? ["formName"] : step === 2 ? ["leadScoring"] : undefined);
    if (!valid) return;

    const next = Math.min(step + 1, steps.length);
    await saveStep(next);
    setStep(next);
  };

  const handleBack = async () => {
    const prev = Math.max(step - 1, 1);
    await saveStep(prev);
    setStep(prev);
  };

  const handleComplete = async () => {
    const valid = await form.trigger();
    if (!valid) return;

    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return navigate("/login");

      const values = form.getValues();
      const { error } = await supabase
        .from("profiles")
        .update({
          first_form_name: values.formName,
          lead_scoring: values.leadScoring,
          crm_provider: values.crmProvider ?? null,
          onboarding_completed: true,
          onboarding_step: steps.length,
        })
        .eq("id", user.id);
      if (error) throw error;

      toast.success("You're all set! Redirecting to your dashboard...");
      navigate("/dashboard");
    } catch (e: any) {
      toast.error("Couldn't complete onboarding", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <section className="container mx-auto px-4 py-10">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Welcome to SmartForms AI</h1>
            <p className="text-muted-foreground mt-1">Let's get your workspace ready in a few quick steps.</p>
          </header>

          <div className="mb-6">
            <Progress value={progress} />
            <div className="mt-2 text-sm text-muted-foreground">
              Step {step} of {steps.length}: {steps[step - 1].title}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-elevated)]">
            <Form {...form}>
              <form className="space-y-8" onSubmit={(e) => e.preventDefault()} noValidate>
                {step === 1 && (
                  <div>
                    <h2 className="text-xl font-medium mb-2">Create your first form</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Give your form a name. You can add fields and logic after onboarding.
                    </p>
                    <FormField
                      control={form.control}
                      name="formName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Form name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Website Lead Capture" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <h2 className="text-xl font-medium mb-2">Define lead scoring</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Assign weights to different signals. You can fine‑tune later.
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="leadScoring.emailDomainMatch"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email domain match (0‑100)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="leadScoring.jobSeniority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job seniority (0‑100)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="leadScoring.companySize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company size (0‑100)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <h2 className="text-xl font-medium mb-2">Connect your CRM</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose a CRM. We'll guide you to connect it next. You can skip for now.
                    </p>

                    <FormField
                      control={form.control}
                      name="crmProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CRM Provider</FormLabel>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid gap-3 sm:grid-cols-2"
                          >
                            <div className="flex items-center space-x-3 rounded-lg border p-3">
                              <RadioGroupItem id="hubspot" value="hubspot" />
                              <Label htmlFor="hubspot">HubSpot</Label>
                            </div>
                            <div className="flex items-center space-x-3 rounded-lg border p-3">
                              <RadioGroupItem id="salesforce" value="salesforce" />
                              <Label htmlFor="salesforce">Salesforce</Label>
                            </div>
                          </RadioGroup>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("crmProvider") && (
                      <div className="mt-4 text-sm text-muted-foreground">
                        OAuth connection is coming soon. We'll remember your choice.
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="ghost" type="button" onClick={handleBack} disabled={step === 1 || loading}>
                    Back
                  </Button>

                  <div className="ml-auto flex items-center gap-2">
                    {step === 1 && (
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={async () => {
                          await saveStep(1);
                          const name = form.getValues().formName || "Untitled Form";
                          navigate(`/forms/new?name=${encodeURIComponent(name)}`);
                        }}
                        disabled={loading}
                      >
                        Open Form Builder
                      </Button>
                    )}

                    {step < steps.length ? (
                      <Button variant="hero" type="button" onClick={handleNext} disabled={loading}>
                        Continue
                      </Button>
                    ) : (
                      <Button variant="hero" type="button" onClick={handleComplete} disabled={loading}>
                        Finish
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Onboarding;
