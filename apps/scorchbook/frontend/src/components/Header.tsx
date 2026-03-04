import type { FormEvent } from "react";
import type { AuthState } from "../hooks/useAuth";
import type { Filters, ProductType } from "../types";

const brandNames: Record<string, string> = {
  drink: "Quenchbook",
  sauce: "Scorchbook",
  all: "Scorchbook"
};

const brandTaglines: Record<string, string> = {
  drink: "Drink Log",
  sauce: "Hot Sauce Log",
  all: "Taste Log"
};

function AuthMenu({ auth, onSignIn, onSignOut, onError }: Readonly<{
  auth: AuthState;
  onSignIn: (event: FormEvent<HTMLFormElement>, onError: (msg: string) => void) => void;
  onSignOut: () => void;
  onError: (msg: string) => void;
}>) {
  if (auth.status === "signedIn") {
    return (
      <>
        <div className="menu-user">
          <span className="menu-user-label">Signed in as</span>
          <span className="menu-user-name">{auth.username || "Taster"}</span>
        </div>
        <button className="menu-item" onClick={onSignOut}>Sign out</button>
      </>
    );
  }
  if (auth.status === "signedOut") {
    return (
      <form className="menu-auth-form" onSubmit={(e) => onSignIn(e, onError)}>
        <input name="username" placeholder="Username" required autoComplete="username" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
        <button type="submit">Sign in</button>
      </form>
    );
  }
  return <div className="menu-loading">Loading...</div>;
}

type HeaderProps = {
  auth: AuthState;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  formOpen: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  onAdd: () => void;
  onCloseForm: () => void;
  onSignIn: (event: FormEvent<HTMLFormElement>, onError: (msg: string) => void) => void;
  onSignOut: () => void;
  onError: (msg: string) => void;
};

export function Header({ auth, filters, setFilters, formOpen, menuOpen, setMenuOpen, onAdd, onCloseForm, onSignIn, onSignOut, onError }: Readonly<HeaderProps>) {
  const setProductType = (pt: ProductType | "all") => setFilters((f) => ({ ...f, productType: pt }));

  return (
    <header className="header">
      <div className="header-brand">
        <h1>{brandNames[filters.productType] ?? "Scorchbook"}</h1>
        <span className="header-tagline">{brandTaglines[filters.productType] ?? "Taste Log"}</span>
      </div>

      <div className="product-toggle">
        <button className={filters.productType === "sauce" ? "active" : ""} onClick={() => setProductType("sauce")} title="Hot Sauces">
          Sauces
        </button>
        <button className={filters.productType === "all" ? "active" : ""} onClick={() => setProductType("all")} title="All Items">
          All
        </button>
        <button className={filters.productType === "drink" ? "active" : ""} onClick={() => setProductType("drink")} title="Drinks">
          Drinks
        </button>
      </div>

      <div className="header-actions">
        {auth.status === "signedIn" && (
          <button className="add-btn" onClick={() => (formOpen ? onCloseForm() : onAdd())} title={formOpen ? "Close" : "Add tasting"}>
            {formOpen ? "\u00d7" : "+"}
          </button>
        )}

        <div className="menu-container">
          <button className="menu-btn" onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} aria-label="Menu">
            <span className="menu-icon" />
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              <AuthMenu auth={auth} onSignIn={onSignIn} onSignOut={onSignOut} onError={onError} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
