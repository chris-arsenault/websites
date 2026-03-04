import "./App.css";
import { useAuth } from "./hooks/useAuth";
import { useTastings } from "./hooks/useTastings";
import { useFilters } from "./hooks/useFilters";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { TastingCard } from "./components/TastingCard";
import { TastingForm } from "./components/TastingForm";
import { ViewModal } from "./components/ViewModal";
import { DeleteModal } from "./components/DeleteModal";

const App = () => {
  const { auth, menuOpen, setMenuOpen, handleSignIn, handleSignOut } = useAuth();
  const tastings = useTastings(auth);
  const { filters, setFilters, filteredTastings, activeFilterCount, resetFilters } = useFilters(tastings.tastings);

  const searchPlaceholder = filters.productType === "drink" ? "Search drinks..." : filters.productType === "all" ? "Search..." : "Search sauces...";
  const itemLabel = filters.productType === "drink" ? "drink" : filters.productType === "all" ? "item" : "sauce";

  return (
    <div className={`app ${filters.productType === "drink" ? "theme-drink" : "theme-sauce"}`}>
      <Header
        auth={auth}
        filters={filters}
        setFilters={setFilters}
        formOpen={tastings.formOpen}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onAdd={tastings.openAddForm}
        onCloseForm={tastings.closeForm}
        onSignIn={handleSignIn}
        onSignOut={() => handleSignOut(() => { tastings.closeForm(); tastings.closeViewModal(); })}
        onError={tastings.setErrorMessage}
      />

      <SearchBar
        filters={filters}
        setFilters={setFilters}
        activeFilterCount={activeFilterCount}
        searchPlaceholder={searchPlaceholder}
        onReset={resetFilters}
      />

      {tastings.errorMessage && <div className="error-banner">{tastings.errorMessage}</div>}

      {tastings.formOpen && (
        <TastingForm
          formMode={tastings.formMode}
          form={tastings.form}
          setForm={tastings.setForm}
          showManualFields={tastings.showManualFields}
          setShowManualFields={tastings.setShowManualFields}
          mediaExpanded={tastings.mediaExpanded}
          setMediaExpanded={tastings.setMediaExpanded}
          submitStatus={tastings.submitStatus}
          viewingRecord={tastings.viewingRecord}
          productType={filters.productType}
          onSubmit={tastings.handleSubmit}
          onClose={tastings.closeForm}
          onError={tastings.setErrorMessage}
        />
      )}

      {tastings.viewOpen && tastings.viewingRecord && (
        <ViewModal record={tastings.viewingRecord} onClose={tastings.closeViewModal} />
      )}

      <main className="content">
        <div className="content-header">
          <span className="content-count">{filteredTastings.length} {filteredTastings.length === 1 ? itemLabel : `${itemLabel}s`}</span>
        </div>

        {tastings.loading ? (
          <div className="loading">Loading your collection...</div>
        ) : filteredTastings.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🌶️</span>
            <p>{tastings.tastings.length === 0 ? `No ${itemLabel}s yet. Add your first tasting!` : `No ${itemLabel}s match your filters.`}</p>
          </div>
        ) : (
          <div className="card-grid">
            {filteredTastings.map((item) => (
              <TastingCard
                key={item.id}
                item={item}
                auth={auth}
                productTypeFilter={filters.productType}
                rerunId={tastings.rerunId}
                onView={() => tastings.openViewModal(item)}
                onEdit={() => tastings.openEditForm(item)}
                onRerun={() => tastings.handleRerun(item)}
                onDelete={() => tastings.openDeleteModal(item)}
              />
            ))}
          </div>
        )}
      </main>

      {tastings.deleteTarget && (
        <DeleteModal
          target={tastings.deleteTarget}
          deleting={tastings.deleteStatus === "deleting"}
          onConfirm={tastings.confirmDelete}
          onClose={tastings.closeDeleteModal}
        />
      )}

      <footer className="app-footer">
        <span>Copyright © 2025</span>
        <a href="https://ahara.io" target="_blank" rel="noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
      </footer>
    </div>
  );
};

export default App;
