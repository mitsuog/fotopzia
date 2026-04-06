import { redirect } from 'next/navigation'

export default function InventoryCategoriesPage() {
  redirect('/inventory?seccion=categorias')
}
