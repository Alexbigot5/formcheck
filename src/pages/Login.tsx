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
import { LoginRequest } from "@/lib/types";

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type FormValues = z.infer<typeof schema>;

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    document.title = "Log in | SmartForms AI";

    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Log in to your SmartForms AI account.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/login`);
  }, []);

  // Separate effect for authentication redirect to prevent loops
  useEffect(() => {
    // Only redirect if authenticated AND not currently loading
    // Add a small delay to prevent flash
    if (isAuthenticated && !isLoading) {
      const timer = setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, navigate]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await login({
        email: values.email,
        password: values.password,
      });
      
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Login error details:", error);
      
      // Provide more helpful error messages
      let errorMessage = error.message || "Invalid email or password";
      
      if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Account not found. Please create an account first or enable mock authentication for development.";
      }
      
      toast.error("Login failed", { 
        description: errorMessage,
        duration: 6000 // Show longer for more detailed message
      });
    }
  };

  const handleQuickLogin = async () => {
    console.log("Quick login clicked");
    try {
      console.log("Attempting login...");
      // Use form values for login
      const formValues = form.getValues();
      await login({
        email: formValues.email,
        password: formValues.password,
      });
      
      console.log("Login successful, navigating to dashboard");
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Login failed:", error);
      toast.error("Login failed", { 
        description: error.message || "Invalid email or password" 
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
              Log in to SmartForms AI
            </h1>
            <p className="mb-8 text-muted-foreground">
              Welcome back. Enter your details to continue.
              {import.meta.env.VITE_MOCK_AUTH === 'true' && (
                <span className="block mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  🚀 Mock auth enabled - use any email/password to login!
                </span>
              )}
            </p>

            <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-elevated)]">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                  noValidate
                  id="login-form"
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
                            autoComplete="current-password"
                            placeholder="********"
                            required
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    onClick={handleQuickLogin}
                    type="button" 
                    size="lg" 
                    className="w-full" 
                    variant="hero"
                    disabled={isLoading}
                  >
                    {isLoading ? "Logging in..." : "Log in"}
                  </Button>

                  <div className="text-center">
                    <Button variant="link" asChild>
                      <Link to="/register" aria-label="Create a SmartForms AI account">
                        New here? Create an account
                      </Link>
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

export default Login;
