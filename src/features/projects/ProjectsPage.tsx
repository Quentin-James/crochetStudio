import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { categoryList } from '../../core/categories'
import type { Project } from '../../core/types'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  PageHeader,
  SegmentedControl,
  type Segment,
} from '../../design/components'
import { useSettings } from '../../app/SettingsProvider'
import { NewProjectDialog } from './NewProjectDialog'
import { ProjectCard } from './ProjectCard'
import {
  countByCategory,
  filterAndSortProjects,
  useAllProjects,
  type CategoryFilter,
  type SortKey,
} from './useProjects'
import { useProjectActions } from './useProjectActions'
import './ProjectsPage.css'

/** Only a known category survives from the URL; anything else shows everything. */
function readCategoryParam(value: string | null): CategoryFilter {
  const known = categoryList().map((definition) => definition.id as CategoryFilter)
  return value !== null && known.includes(value as CategoryFilter)
    ? (value as CategoryFilter)
    : 'all'
}

const SORTS: Segment<SortKey>[] = [
  { value: 'updated', label: 'Modifiés' },
  { value: 'created', label: 'Récents' },
  { value: 'name', label: 'Nom' },
]

export function ProjectsPage() {
  const { settings } = useSettings()
  const projects = useAllProjects()
  const actions = useProjectActions()

  // `?new=1` lets the dashboard's button open the creation form here.
  const [searchParams, setSearchParams] = useSearchParams()
  const creating = searchParams.get('new') === '1'

  const [search, setSearch] = useState('')
  // The dashboard's category tiles link here with `?category=bag`.
  const [category, setCategory] = useState<CategoryFilter>(() =>
    readCategoryParam(searchParams.get('category')),
  )
  const [sort, setSort] = useState<SortKey>('updated')
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)

  const counts = useMemo(() => countByCategory(projects ?? []), [projects])

  const visible = useMemo(
    () => filterAndSortProjects(projects ?? [], { search, category, sort }),
    [projects, search, category, sort],
  )

  const categorySegments: Segment<CategoryFilter>[] = [
    { value: 'all', label: 'Tous', count: projects?.length ?? 0 },
    ...categoryList().map((definition) => ({
      value: definition.id as CategoryFilter,
      label: definition.pluralLabel,
      count: counts[definition.id],
    })),
  ]

  const openCreate = () => {
    const next = new URLSearchParams(searchParams)
    next.set('new', '1')
    setSearchParams(next)
  }

  const closeCreate = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const deleted = await actions.remove(pendingDelete.id)
    if (deleted) setPendingDelete(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Bibliothèque"
        title="Mes projets"
        lede="Toutes vos robes, vos sacs et vos accessoires, conservés sur cet appareil."
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            Nouveau projet
          </Button>
        }
      />

      {actions.error && (
        <p className="cs-projects__error" role="alert">
          {actions.error}
        </p>
      )}

      {projects !== undefined && projects.length > 0 && (
        <div className="cs-projects__toolbar">
          <div className="cs-projects__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={search}
              placeholder="Chercher par nom, fil ou note"
              aria-label="Chercher un projet"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <SegmentedControl
            label="Filtrer par catégorie"
            size="sm"
            value={category}
            segments={categorySegments}
            onValueChange={setCategory}
          />
          <SegmentedControl
            label="Trier les projets"
            size="sm"
            value={sort}
            segments={SORTS}
            onValueChange={setSort}
          />
        </div>
      )}

      {projects === undefined ? (
        <p className="cs-projects__loading">Chargement de votre bibliothèque…</p>
      ) : projects.length === 0 ? (
        <EmptyState
          icon="yarn"
          title="Votre bibliothèque est vide"
          description="Partez des mesures finies de la pièce que vous avez en tête. Tout reste modifiable ensuite — rien n’est figé."
          action={
            <Button variant="primary" icon="plus" onClick={openCreate}>
              Créer mon premier projet
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="search"
          title="Aucun résultat"
          description="Essayez une autre recherche, ou enlevez le filtre de catégorie pour tout revoir."
          action={
            <Button
              onClick={() => {
                setSearch('')
                setCategory('all')
              }}
            >
              Effacer les filtres
            </Button>
          }
        />
      ) : (
        <ul className="cs-projects__grid">
          {visible.map((project) => (
            <li key={project.id}>
              <ProjectCard
                project={project}
                units={settings.units}
                onDuplicate={(target) => void actions.duplicate(target.id)}
                onDelete={setPendingDelete}
              />
            </li>
          ))}
        </ul>
      )}

      <NewProjectDialog
        open={creating}
        units={settings.units}
        busy={actions.busy}
        onCancel={closeCreate}
        onCreate={(draft) => void actions.create(draft)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer ce projet ?"
        description={
          pendingDelete
            ? `« ${pendingDelete.name} » et son motif seront effacés de cet appareil. C’est irréversible, sauf si vous avez une sauvegarde.`
            : ''
        }
        confirmLabel="Supprimer le projet"
        destructive
        busy={actions.busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}
