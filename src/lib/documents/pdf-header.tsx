/* @jsxImportSource react */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface HeaderOpts {
  docType: string
  docNumber: string
  clientName: string
  subtitle?: string
}

// Accepts the @react-pdf/renderer primitives as `any` to avoid
// complex type gymnastics with its dual Text/SVGText union types.
export function buildDocumentHeader(
  primitives: { View: any; Text: any; StyleSheet: any },
  opts: HeaderOpts,
): React.ReactElement {
  const { View, Text, StyleSheet } = primitives
  const styles = StyleSheet.create({
    header: {
      marginBottom: 18,
      borderBottomWidth: 2,
      borderBottomColor: '#1C2B4A',
      paddingBottom: 10,
    },
    brand: { fontSize: 17, fontWeight: 'bold', color: '#1C2B4A' },
    subBrand: { fontSize: 8.5, color: '#7a7a7a', marginTop: 2 },
    docType: { marginTop: 10, fontSize: 11, fontWeight: 'bold', color: '#C49A2A' },
    meta: { marginTop: 3, fontSize: 9, color: '#4b5563' },
  })

  return (
    <View style={styles.header}>
      <Text style={styles.brand}>Fotopzia Mexico</Text>
      <Text style={styles.subBrand}>{opts.subtitle ?? 'Fotografia y video profesional'}</Text>
      <Text style={styles.docType}>{opts.docType}</Text>
      <Text style={styles.meta}>{opts.docNumber}</Text>
      <Text style={styles.meta}>Cliente: {opts.clientName}</Text>
    </View>
  )
}
