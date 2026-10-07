import React, { useState, useEffect } from 'react';
import { Layers, ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/client';

export const ScopeSwitcher = () => {
  const { scope, setScope } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [sites, setSites] = useState([]);
  const [labs, setLabs] = useState([]);

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const [sitesData, labsData] = await Promise.all([
          api.getSites().catch(() => []),
          api.getLabs().catch(() => []),
        ]);
        setSites(Array.isArray(sitesData) ? sitesData : []);
        setLabs(Array.isArray(labsData) ? labsData : []);
      } catch (err) {
        console.error('Failed to load scope hierarchy:', err);
      }
    };

    fetchHierarchy();
  }, []);

  const handleSelect = (newScope) => {
    setScope(newScope);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          fontWeight: 600,
          padding: '4px 10px',
          height: '30px',
        }}
        title="Change Scope Filter"
      >
        <Layers size={13} style={{ color: 'var(--accent-primary)' }} />
        <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {scope.name || 'All Fleet'}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }}
            onClick={() => setIsOpen(false)}
          />

          <div
            className="panel"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              width: '240px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 'calc(var(--z-dropdown) + 1)',
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              maxHeight: '320px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              Select Fleet Scope
            </div>

            {/* Global Fleet Option */}
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleSelect({ orgId: null, siteId: null, labId: null, name: 'All Fleet' })}
              style={{
                justifyContent: 'space-between',
                border: 'none',
                background: !scope.labId && !scope.siteId ? 'var(--accent-subtle)' : 'transparent',
                color: !scope.labId && !scope.siteId ? 'var(--accent-text)' : 'var(--text-primary)',
                fontWeight: !scope.labId && !scope.siteId ? 600 : 400,
                width: '100%',
                padding: '6px 8px',
                textAlign: 'left',
              }}
            >
              <span>🌍 All Fleet (Global)</span>
              {!scope.labId && !scope.siteId && <Check size={14} />}
            </button>

            {/* Sites and Labs */}
            {sites.map((site) => (
              <div key={site.id} style={{ marginTop: '4px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    padding: '4px 8px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    borderRadius: 'var(--radius-xs)',
                  }}
                >
                  📍 {site.name}
                </div>

                {labs
                  .filter((lab) => lab.site_id === site.id)
                  .map((lab) => {
                    const isSelected = scope.labId === lab.id;
                    return (
                      <button
                        key={lab.id}
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          handleSelect({
                            orgId: site.org_id,
                            siteId: site.id,
                            labId: lab.id,
                            name: `${site.name} / ${lab.name}`,
                          })
                        }
                        style={{
                          justifyContent: 'space-between',
                          border: 'none',
                          background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                          color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)',
                          fontWeight: isSelected ? 600 : 400,
                          width: '100%',
                          padding: '6px 8px 6px 20px',
                          textAlign: 'left',
                        }}
                      >
                        <span>💻 {lab.name}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
