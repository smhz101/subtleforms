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

import { useState, useEffect, useRef, Suspense } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { __, sprintf } from '@wordpress/i18n';
import { getBranding } from '../utils/branding';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { UpgradeModal } from '../ui';
import useWpAdminSync from './useWpAdminSync';

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
const PaymentsPage       = lazyWithRetry(() => import(/* webpackChunkName: "page-payments" */       '../pages/PaymentsPage'));
const ToolsPage          = lazyWithRetry(() => import(/* webpackChunkName: "page-tools" */          '../pages/ToolsPage'));
const ReportsPage        = lazyWithRetry(() => import(/* webpackChunkName: "page-reports" */        '../pages/ReportsPage'));
const CreateFormPage     = lazyWithRetry(() => import(/* webpackChunkName: "page-create-form" */    '../pages/CreateFormPage'));

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

		case 'subtleforms-payments':
			return '/payments';

		case 'subtleforms-tools':
			return '/tools';

		case 'subtleforms-reports':
			return '/reports';

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

// ─── Route announcer for screen readers ──────────────────────────────────────

function getPageNameFromPath(pathname) {
	const map = {
		'/': __('Dashboard', 'subtleforms'),
		'/forms': __('Forms', 'subtleforms'),
		'/forms/new': __('Form Builder', 'subtleforms'),
		'/submissions': __('Submissions', 'subtleforms'),
		'/settings': __('Settings', 'subtleforms'),
		'/extensions': __('Extensions', 'subtleforms'),
		'/payments': __('Payments', 'subtleforms'),
		'/tools': __('Tools', 'subtleforms'),
		'/reports': __('Reports', 'subtleforms'),
	};
	if (pathname.startsWith('/forms/') && pathname !== '/forms/new') {
		return __('Form Builder', 'subtleforms');
	}
	if (pathname.startsWith('/submissions/')) {
		return __('Submission Detail', 'subtleforms');
	}
	return map[pathname] || getBranding().name;
}

function RouteAnnouncer() {
	const location = useLocation();
	const [announcement, setAnnouncement] = useState('');

	useEffect(() => {
		setAnnouncement(
			sprintf(__('Navigated to %s', 'subtleforms'), getPageNameFromPath(location.pathname))
		);
	}, [location.pathname]);

	return (
		<div
			role='status'
			aria-live='polite'
			aria-atomic='true'
			className='sf-sr-only'
		>
			{announcement}
		</div>
	);
}

/**
 * Form-scoped notices (save errors and validation messages of the form being
 * edited, ids starting with "subtleforms-form-") belong to that form: they
 * are cleared when the user leaves the form's route (2.3.1, QA-03).
 */
export function isFormScopedNotice(notice) {
	return typeof notice?.id === 'string' && notice.id.indexOf('subtleforms-form-') === 0;
}

function FormNoticeCleaner() {
	const location = useLocation();
	const notices = useSelect((select) => select(noticesStore).getNotices(), []);
	const { removeNotice } = useDispatch(noticesStore);
	const previous = useRef(location.pathname);
	useEffect(() => {
		if (previous.current === location.pathname) return;
		previous.current = location.pathname;
		notices.filter(isFormScopedNotice).forEach((n) => removeNotice(n.id));
		// Messages the previous screen spoke to screen readers stay in the
		// live regions until the next one; they no longer apply.
		document
			.querySelectorAll('#a11y-speak-polite, #a11y-speak-assertive')
			.forEach((region) => {
				region.textContent = '';
			});
		// Only route changes clear notices.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [location.pathname]);
	return null;
}

// ─── App content (inside router context) ─────────────────────────────────────

function AppContent() {
	const navigate  = useNavigate();

	// Keep the URL, admin submenu and tab title in step with the router.
	useWpAdminSync(getPageNameFromPath);

	// Modal kept intact but no longer triggered by /forms/new (now a full page)
	const [showCreateModal, setShowCreateModal] = useState(false);

	// Bug 1 fix: compute content-area offset so the modal overlay can be
	// scoped to the plugin container rather than the full viewport.
	useEffect(() => {
		const updateBounds = () => {
			const contentEl = document.getElementById('wpcontent');
			const adminBar  = document.getElementById('wpadminbar');
			if (contentEl) {
				const { left } = contentEl.getBoundingClientRect();
				document.documentElement.style.setProperty(
					'--sf-modal-offset-left',
					`${Math.round(left)}px`
				);
			}
			const barHeight = adminBar ? adminBar.offsetHeight : 32;
			document.documentElement.style.setProperty(
				'--sf-modal-offset-top',
				`${barHeight}px`
			);
		};
		updateBounds();
		window.addEventListener('resize', updateBounds);
		return () => window.removeEventListener('resize', updateBounds);
	}, []);

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
		<>
			<RouteAnnouncer />
			<FormNoticeCleaner />
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
					{/* /forms/new — full-page creation experience */}
					<Route
						path='/forms/new'
						element={
							<PageErrorBoundary pageName='Create Form'>
								<CreateFormPage />
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
						path='/tools'
						element={
							<PageErrorBoundary pageName='Tools'>
								<ToolsPage />
							</PageErrorBoundary>
						}
					/>
					<Route
						path='/reports'
						element={
							<PageErrorBoundary pageName='Reports'>
								<ReportsPage />
							</PageErrorBoundary>
						}
					/>
					<Route
						path='/payments'
						element={
							<PageErrorBoundary pageName='Payments'>
								<PaymentsPage />
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

			<CreateFormModal
				isOpen={showCreateModal}
				onClose={handleModalClose}
				onFormCreated={handleFormCreated}
			/>
			<UpgradeModal />
		</>
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
