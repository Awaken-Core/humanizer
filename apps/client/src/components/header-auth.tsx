"use client";
import { useLocale, useTranslations } from "next-intl";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState, useEffect, useSyncExternalStore } from "react";
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
import { Field, FieldError, FieldGroup, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";
import { GoogleIcon } from "@/components/auth/google-svg";

const subscribeToMount = () => () => {};
const localePath = (locale: string) => `/${locale}`;

export function HeaderAuth() {
  const t = useTranslations("UI");
  const locale = useLocale();
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
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
    return () => window.removeEventListener("country-rank:open-sign-in", openSignIn);
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
        ? await signIn.email({ email, password, callbackURL: localePath(locale) })
        : await signUp.email({
            name: String(formData.get("name")),
            email,
            password,
            callbackURL: localePath(locale),
          });

      if (result.error) {
        setError(result.error.message ?? t('connectionError'));
      }
    } catch {
      setError(t('connectionError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await signIn.social({ provider: "google", callbackURL: localePath(locale) });
      if (result?.error) {
        setError(result.error.message ?? t('connectionError'));
        setIsSubmitting(false);
      }
    } catch {
      setError(t('connectionError'));
      setIsSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="rounded-full px-3 sm:px-4 text-xs font-medium opacity-60">
          {t('signIn')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {isSessionPending ? (
        <Button variant="outline" size="sm" disabled>
          {t('loading')}
        </Button>
      ) : session?.user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 gap-0 rounded-full p-1 sm:gap-2 sm:pr-3 sm:pl-1">
              <Avatar size="sm">
                {session.user.image && (
                  <AvatarImage src={session.user.image} alt={session.user.name || "User"} />
                )}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-32 truncate text-xs sm:inline">{session.user.name || session.user.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="min-w-0">
              <p className="truncate font-medium">{session.user.name || t('myAccount')}</p>
              <p className="truncate font-normal text-muted-foreground text-xs">{session.user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(['ADMIN', 'SUPER_ADMIN'].includes(
              (session.user as typeof session.user & {role?: string}).role ?? ''
            )) && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer text-xs">
                  {t('adminConsole')}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
              {t('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full px-3 sm:px-4 text-xs font-medium">
              {t('signIn')}
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
                <p className="text-base font-semibold tracking-tight">{t('start')}</p>
                <p className="mt-1 text-xs text-white/75">{t('votePitch')}</p>
              </div>
            </div>

            <form onSubmit={handleCredentials} className="flex flex-col justify-center gap-5 p-6 sm:p-8">
              <DialogHeader className="gap-2">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {isLogin ? t('welcome') : t('createAccount')}
                </DialogTitle>
                <DialogDescription>
                  {isLogin
                    ? t('loginDescription')
                    : t('registerDescription')}
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
                <GoogleIcon /> {t('google')}
              </Button>
              <FieldSeparator>{t('emailDivider')}</FieldSeparator>

              <FieldGroup className="gap-3">
                {!isLogin && (
                  <Field>
                    <Label htmlFor="auth-name">{t('fullName')}</Label>
                    <Input id="auth-name" name="name" autoComplete="name" placeholder="Jane Smith" required />
                  </Field>
                )}
                <Field>
                  <Label htmlFor="auth-email">{t('email')}</Label>
                  <Input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
                </Field>
                <Field>
                  <Label htmlFor="auth-password">{t('password')}</Label>
                  <Input
                    id="auth-password"
                    name="password"
                    type="password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder={t('passwordHint')}
                    minLength={8}
                    required
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>

              <Button type="submit" size="lg" className="h-9 w-full text-xs font-semibold" disabled={isSubmitting}>
                {isSubmitting ? t('wait') : isLogin ? t('signIn') : t('createAccount')}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {isLogin ? t('newHere') : t('existingAccount')}{" "}
                <button
                  type="button"
                  onClick={changeMode}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {isLogin ? t('createAccount') : t('signIn')}
                </button>
              </p>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
