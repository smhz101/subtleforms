/**
 * Admin Application Root
 *
 * Main application component that handles routing and global providers.
 * Uses react-router-dom MemoryRouter for SPA navigation within WordPress admin.
 * Initial route is derived from WordPress URL params on page load.
 *
 * Route structure:
 *   /                       → Dashboard
 *   /forms                  → Forms list
 *   /forms/new              → Form builder (new form wizard)
 *   /forms/:formId          → Form builder (existing form)
 *   /submissions            → Submissions list  (?form_id=N for filtered view)
 *   /submissions/:id        → Submission detail (?form_id=N for back navigation)
 *   /settings               → Settings
 *   /extensions             → Extensions
 */

import { useState, useEffect, Suspense } from '@wordpress/element';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Panel, PanelBody } from '@wordpress/components';
import {
	MemoryRouter,
	Routes,
	Route,
	useNavigate,
	useParams,
	useSearchParams,
	useLocation,
} from 'react-router-dom';
import { NoticeProvider, ErrorBoundary } from '../ui/feedback';
import { ModalProvider } from '../ui/modals';
import PageErrorBoundary from '../components/PageErrorBoundary';
import { RouteLoadingFallback } from '../components/RouteTransition';
import { CreateFormModal } from '../modals';

// ─── Query Client ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 30 * 1000,
		},
		mutations: {
			retry: 1,
		},
	},
});

// ─── Code-split pages ─────────────────────────────────────────────────────────

import lazyWithRetry from '../utils/lazyWithRetry';

const DashboardPage      = lazyWithRetry(() => import(/* webpackChunkName: "page-dashboard" */      '../pages/DashboardPage'));
const SettingsPage       = lazyWithRetry(() => import(/* webpackChunkName: "page-settings" */       '../pages/SettingsPage'));
const FormsPage          = lazyWithRetry(() => import(/* webpackChunkName: "page-forms" */          '../pages/FormsPage'));
const SubmissionsPage    = lazyWithRetry(() => import(/* webpackChunkName: "page-submissions" */    '../pages/SubmissionsPage'));
const SubmissionDetailPage = lazyWithRetry(() => import(/* webpackChunkName: "page-submission-detail" */ '../pages/SubmissionDetailPage'));
const BuilderPage        = lazyWithRetry(() => import(/* webpackChunkName: "page-builder" */        '../pages/BuilderPage'));
const ExtensionsPage     = lazyWithRetry(() => import(/* webpackChunkName: "page-extensions" */     '../pages/ExtensionsPage'));

// ─── Initial path resolver ────────────────────────────────────────────────────

/**
 * Map WordPress admin URL params to a MemoryRouter initial entry path.
 * Called once at startup — not reactive.
 */
function getInitialPath() {
	const url        = new URL(window.location.href);
	const page       = url.searchParams.get('page') || 'subtleforms';
	const formId     = url.searchParams.get('form_id');
	const subId      = url.searchParams.get('submission_id');

	switch (page) {
		case 'subtleforms-forms':
			return '/forms';

		case 'subtleforms-new-form':
			return formId ? `/forms/${formId}` : '/forms/new';

		case 'subtleforms-submissions': {
			if (subId) {
				return `/submissions/${subId}${formId ? `?form_id=${formId}` : ''}`;
			}
			return formId ? `/submissions?form_id=${formId}` : '/submissions';
		}

		case 'subtleforms-settings':
			return '/settings';

		case 'subtleforms-extensions':
			return '/extensions';

		default:
			return '/';
	}
}

// ─── Route wrapper components ─────────────────────────────────────────────────

/** Submissions list — reads optional ?form_id query param */
function SubmissionsRoute() {
	const [searchParams] = useSearchParams();
	const formId = searchParams.get('form_id')
		? parseInt(searchParams.get('form_id'), 10)
		: null;
	return (
		<PageErrorBoundary pageName='Submissions'>
			<SubmissionsPage formId={formId} />
		</PageErrorBoundary>
	);
}

/** Submission detail — reads :submissionId param + optional ?form_id */
function SubmissionDetailRoute() {
	const { submissionId } = useParams();
	const [searchParams]   = useSearchParams();
	const navigate         = useNavigate();
	const formId = searchParams.get('form_id')
		? parseInt(searchParams.get('form_id'), 10)
		: null;
	const parsedId = parseInt(submissionId, 10);

	return (
		<PageErrorBoundary pageName='Submission Detail'>
			<SubmissionDetailPage
				submissionId={parsedId}
				formId={formId}
				onBack={() =>
					navigate(formId ? `/submissions?form_id=${formId}` : '/submissions')
				}
			/>
		</PageErrorBoundary>
	);
}

// ─── App content (inside router context) ─────────────────────────────────────

function AppContent() {
	const navigate  = useNavigate();
	const location  = useLocation();

	// Show "create form" modal when route is /forms/new
	const [showCreateModal, setShowCreateModal] = useState(
		location.pathname === '/forms/new'
	);

	useEffect(() => {
		if (location.pathname === '/forms/new') {
			setShowCreateModal(true);
		}
	}, [location.pathname]);

	function handleModalClose() {
		setShowCreateModal(false);
		navigate('/forms');
	}

	function handleFormCreated(createdFormId) {
		setShowCreateModal(false);
		navigate('/forms/' + createdFormId);
	}

	function handleFormSaved(detail) {
		// intentionally quiet in production
		void detail;
	}

	return (
		<div>
			<Panel>
				<PanelBody>
					<Suspense fallback={<RouteLoadingFallback />}>
						<Routes>
							<Route
								path='/'
								element={
									<PageErrorBoundary pageName='Dashboard'>
										<DashboardPage />
									</PageErrorBoundary>
								}
							/>
							<Route
								path='/forms'
								element={
									<PageErrorBoundary pageName='Forms'>
										<FormsPage />
									</PageErrorBoundary>
								}
							/>
							{/* /forms/new — wizard; modal handled by AppContent */}
							<Route
								path='/forms/new'
								element={
									<PageErrorBoundary pageName='Form Builder'>
										<BuilderPage onFormSaved={handleFormSaved} />
									</PageErrorBoundary>
								}
							/>
							{/* /forms/:formId — existing form */}
							<Route
								path='/forms/:formId'
								element={
									<PageErrorBoundary pageName='Form Builder'>
										<BuilderPage onFormSaved={handleFormSaved} />
									</PageErrorBoundary>
								}
							/>
							<Route path='/submissions' element={<SubmissionsRoute />} />
							<Route
								path='/submissions/:submissionId'
								element={<SubmissionDetailRoute />}
							/>
							<Route
								path='/settings'
								element={
									<PageErrorBoundary pageName='Settings'>
										<SettingsPage />
									</PageErrorBoundary>
								}
							/>
							<Route
								path='/extensions'
								element={
									<PageErrorBoundary pageName='Extensions'>
										<ExtensionsPage />
									</PageErrorBoundary>
								}
							/>
						</Routes>
					</Suspense>
				</PanelBody>
			</Panel>

			<CreateFormModal
				isOpen={showCreateModal}
				onClose={handleModalClose}
				onFormCreated={handleFormCreated}
			/>
		</div>
	);
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function AdminApp() {
	return (
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<NoticeProvider>
					<ModalProvider>
						<MemoryRouter initialEntries={[getInitialPath()]}>
							<AppContent />
						</MemoryRouter>
					</ModalProvider>
				</NoticeProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}
