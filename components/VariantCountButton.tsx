import React from 'react';

interface VariantCountButtonProps {
    variantCount: number;
    onClick: () => void;
}

const VariantCountButton = React.memo(({ variantCount, onClick }: VariantCountButtonProps) => (
    <button
        type="button"
        className="variant-toggle"
        onClick={onClick}
        title={`Generate ${variantCount} variant${variantCount > 1 ? 's' : ''}`}
        aria-label={`Generate ${variantCount} variant${variantCount > 1 ? 's' : ''}`}
    >
        <span>{variantCount}x</span>
    </button>
));

export default VariantCountButton;
