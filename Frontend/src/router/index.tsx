import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";


interface RouterContextType {
  path: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  path: "/admin/dashboard",
  navigate: () => {},
});

export function useRouter() {
  return useContext(RouterContext);
}

interface RouterProviderProps {
  children: ReactNode;
}

export function RouterProvider({ children }: RouterProviderProps) {
  // Read current pathname, with hash (#/admin/login) or query (?page=/admin/login) fallback for static host compatibility
  const getInitialPath = () => {
    if (typeof window === "undefined") return "/";
    if (window.location.hash) {
      const cleanHash = window.location.hash.replace(/^#/, "");
      if (cleanHash.startsWith("/")) return cleanHash;
    }
    const params = new URLSearchParams(window.location.search);
    const queryPath = params.get("page") || params.get("p");
    if (queryPath) {
      return queryPath.startsWith("/") ? queryPath : `/${queryPath}`;
    }
    return window.location.pathname || "/";
  };

  const [path, setPath] = useState<string>(getInitialPath);

  useEffect(() => {
    const onPopState = () => {
      setPath(getInitialPath());
    };

    const onHashChange = () => {
      if (window.location.hash) {
        const cleanHash = window.location.hash.replace(/^#/, "");
        if (cleanHash.startsWith("/")) setPath(cleanHash);
      }
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const navigate = (to: string) => {
    if (to === path) return;
    window.history.pushState({}, "", to);
    setPath(to);
    window.scrollTo(0, 0);
  };

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
}

export function Link({ to, children, className = "", activeClassName = "", ...rest }: LinkProps) {
  const { path, navigate } = useRouter();
  const isActive = path === to || (to !== "/admin/dashboard" && path.startsWith(to));

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate(to);
  };

  const combinedClass = `${className} ${isActive ? activeClassName : ""}`.trim();

  return (
    <a href={to} onClick={handleClick} className={combinedClass} {...rest}>
      {children}
    </a>
  );
}
