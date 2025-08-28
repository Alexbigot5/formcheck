import React, { useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/\d/, "Password must include at least one number."),
  company: z.string().min(2, "Company name is required."),
});

type FormValues = z.infer<typeof schema>;

const Register = () => {
  const navigate = useNavigate();
  const { signUp, isLoading, isAuthenticated } = useAuth();
  useEffect(() => {
    document.title = "Create Account | SmartForms AI";

    // Meta description
    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute(
      "content",
      "Create your SmartForms AI account. Sign up with email, password, and company name."
    );
    if (!existingMeta) document.head.appendChild(metaDesc);

    // Canonical tag
    let linkCanonical = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/register`);

    // Redirect if already authenticated
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [navigate, isAuthenticated]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      company: "",
    },
    mode: "onBlur",
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await signUp(values.email, values.password);
      toast.success("Account created successfully!");
      toast.info("Welcome to SmartForms AI! You can now log in.");
      navigate("/login");
    } catch (error: any) {
      toast.error("Sign up failed", { 
        description: error.message || "Please try again." 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <section className="container mx-auto px-4 py-14">
          <div className="mx-auto max-w-md">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">
              Create your SmartForms AI account
            </h1>
            <p className="mb-8 text-muted-foreground">
              Sign up to start building dynamic, AI‑powered forms in minutes.
            </p>

            <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-elevated)]">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                  noValidate
                  id="registration-form"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="you@company.com"
                            required
                            autoFocus
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder="********"
                            required
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company name</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            autoComplete="organization"
                            placeholder="Acme Inc."
                            required
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" size="lg" className="w-full" variant="hero" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create account"}
                  </Button>
                  <div className="text-center">
                    <Button variant="link" asChild>
                      <Link to="/login" aria-label="Log in to SmartForms AI">Already have an account? Log in</Link>
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Register;
