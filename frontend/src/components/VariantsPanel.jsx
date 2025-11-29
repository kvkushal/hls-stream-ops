function VariantsPanel({ variants }) {
  if (!variants || variants.length === 0) {
    return null
  }

  return (
    <div className="variants-section">
      <h3>Variant Streams</h3>
      <div className="variants-table">
        <div className="variants-header">
          <span>Resolution</span>
          <span>Bandwidth</span>
          <span>URL</span>
        </div>
        {variants.map((variant, index) => (
          <div key={index} className="variant-row">
            <span className="variant-resolution">{variant.resolution}</span>
            <span className="variant-bandwidth">
              {(variant.bandwidth / 1000000).toFixed(2)} Mbps
            </span>
            <span className="variant-url" title={variant.url}>
              {variant.url.substring(0, 60)}...
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default VariantsPanel