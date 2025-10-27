
import React, { useState } from 'react';

interface TabProps {
  label: string;
  children: React.ReactNode;
}

export const Tab: React.FC<TabProps> = ({ children }) => {
  return <>{children}</>;
};

interface TabsProps {
  children: React.ReactElement<TabProps>[];
}

const Tabs: React.FC<TabsProps> = ({ children }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid #444' }}>
        {children.map((child, index) => (
          <button
            key={child.props.label}
            onClick={() => setActiveIndex(index)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'transparent',
              color: activeIndex === index ? '#d1d4dc' : '#777',
              cursor: 'pointer',
              borderBottom: activeIndex === index ? '2px solid #2962ff' : '2px solid transparent',
              marginBottom: '-1px',
              fontSize: '1rem',
            }}
          >
            {child.props.label}
          </button>
        ))}
      </div>
      <div style={{paddingTop: '1rem'}}>
        {children[activeIndex]}
      </div>
    </div>
  );
};

export default Tabs;
