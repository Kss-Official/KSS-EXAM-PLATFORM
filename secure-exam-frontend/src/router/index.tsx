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
  // Read current pathname, fallback to /admin/dashboard if root
  const getInitialPath = () => {
    return window.location.pathname || "/";
  };

  const [path, setPath] = useState<string>(getInitialPath);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname || "/");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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
