"use client";
import Image from "next/image";
import Link from "next/link";
import {
  type FormEvent,
  useState,
  useEffect,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";
import { GoogleIcon } from "@/components/auth/google-svg";
import { UserRound } from "lucide-react";
import { toast } from "sonner";

const subscribeToMount = () => () => {};

export function HeaderAuth({ compact = false }: { compact?: boolean }) {
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );
  const { data: session, isPending: isSessionPending } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isLogin = mode === "login";

  useEffect(() => {
    const openSignIn = () => {
      setMode("login");
      setError(null);
      setIsOpen(true);
    };
    window.addEventListener("country-rank:open-sign-in", openSignIn);
    return () =>
      window.removeEventListener("country-rank:open-sign-in", openSignIn);
  }, []);

  const initials =
    session?.user.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    session?.user.email?.[0]?.toUpperCase() ||
    "U";

  const changeMode = () => {
    setMode(isLogin ? "register" : "login");
    setError(null);
  };

  const handleCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    try {
      const result = isLogin
        ? await signIn.email({ email, password, callbackURL: "/" })
        : await signUp.email({
            name: String(formData.get("name")),
            email,
            password,
            callbackURL: "/",
          });

      if (result.error) {
        const message =
          result.error.message ?? "Something went wrong. Please try again.";
        setError(message);
        toast.error(message);
      } else {
        toast.success(isLogin ? "Signed in" : "Account created");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (result?.error) {
        const message =
          result.error.message ?? "Something went wrong. Please try again.";
        setError(message);
        toast.error(message);
        setIsSubmitting(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          aria-label="Sign in"
          className={
            compact
              ? "size-10 rounded-full p-0 opacity-60"
              : "rounded-full px-3 sm:px-4 text-xs font-medium opacity-60"
          }
        >
          {compact ? <UserRound className="size-4" /> : "Sign in"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {isSessionPending ? (
        <Button
          variant="outline"
          size="sm"
          disabled
          aria-label="Loading account"
          className={compact ? "size-10 rounded-full p-0" : undefined}
        >
          {compact ? <UserRound className="size-4 opacity-50" /> : "Loading…"}
        </Button>
      ) : session?.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              data-account-trigger
              aria-label={`Open account menu for ${session.user.name || session.user.email}`}
              title={session.user.name || session.user.email}
              className="size-10 rounded-full p-1"
            >
              <Avatar className="size-8 overflow-hidden">
                {session.user.image && (
                  <AvatarImage
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback className="bg-neutral-100 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="min-w-0">
              <p className="truncate font-medium">
                {session.user.name || "My account"}
              </p>
              <p className="truncate font-normal text-muted-foreground text-xs">
                {session.user.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {["ADMIN", "SUPER_ADMIN"].includes(
              (session.user as typeof session.user & { role?: string }).role ??
                "",
            ) && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer text-xs">
                  Admin console
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                void signOut()
                  .then(() => toast.success("Signed out"))
                  .catch(() => toast.error("Unable to sign out"));
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Sign in"
              title="Sign in"
              className={
                compact
                  ? "size-10 rounded-full p-0"
                  : "rounded-full px-3 sm:px-4 text-xs font-medium"
              }
            >
              {compact ? <UserRound className="size-4" /> : "Sign in"}
            </Button>
          </DialogTrigger>
          <DialogContent className="overflow-hidden p-0 sm:max-w-2xl md:grid md:grid-cols-[0.9fr_1.1fr] md:gap-0">
            <div className="relative min-h-36 overflow-hidden md:min-h-[34rem]">
              <Image
                src="/image/auth.png"
                alt="City skyline glowing beside the harbour at night"
                fill
                priority
                unoptimized
                sizes="(min-width: 768px) 300px, calc(100vw - 2rem)"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-base font-medium tracking-tight">
                  Make your text sound human
                </p>
                <p className="mt-1 text-xs text-white/75">
                  Sign in to use for free.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleCredentials}
              className="flex flex-col justify-center gap-5 p-6 sm:p-8"
            >
              <DialogHeader className="gap-2">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {isLogin ? "Welcome back" : "Create account"}
                </DialogTitle>
                <DialogDescription>
                  {isLogin
                    ? "Sign in to continue."
                    : "Create an account to get started."}
                </DialogDescription>
              </DialogHeader>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-9 w-full gap-2 text-xs"
                disabled={isSubmitting}
                onClick={handleGoogle}
              >
                <GoogleIcon /> Continue with Google
              </Button>
              <FieldSeparator>or continue with email</FieldSeparator>

              <FieldGroup className="gap-3">
                {!isLogin && (
                  <Field>
                    <Label htmlFor="auth-name">Full name</Label>
                    <Input
                      id="auth-name"
                      name="name"
                      autoComplete="name"
                      placeholder="Jane Smith"
                      required
                    />
                  </Field>
                )}
                <Field>
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </Field>
                <Field>
                  <Label htmlFor="auth-password">Password</Label>
                  <Input
                    id="auth-password"
                    name="password"
                    type="password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>

              <Button
                type="submit"
                size="lg"
                className="h-9 w-full text-xs font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Please wait…"
                  : isLogin
                    ? "Sign in"
                    : "Create account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {isLogin ? "New here?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={changeMode}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {isLogin ? "Create account" : "Sign in"}
                </button>
              </p>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
