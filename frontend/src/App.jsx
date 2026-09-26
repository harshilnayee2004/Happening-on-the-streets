import { Outlet } from 'react-router-dom';
import AppNav from './shared/components/AppNav.jsx';
import ChatAlerts from './buyer/components/ChatAlerts.jsx';
import LeaveGuard from './shared/components/LeaveGuard.jsx';
import Page from './shared/components/Page.jsx';
import { GuestWorkspaceProvider } from './shared/guestWorkspace.jsx';
import { referralLinks } from './shared/nav.js';
import Home from './buyer/pages/Home.jsx';
import Marketing from './shared/pages/Marketing.jsx';
import LearnMore from './buyer/pages/LearnMore.jsx';
import Collect from './buyer/pages/Collect.jsx';
import OpenHouse from './buyer/pages/OpenHouse.jsx';
import Workspace from './buyer/pages/Workspace.jsx';
import SharedWorkspace from './buyer/pages/SharedWorkspace.jsx';
import Compare from './buyer/pages/Compare.jsx';
import RealtorHome from './realtor/pages/RealtorHome.jsx';
import CreateWorkspace from './realtor/pages/CreateWorkspace.jsx';
import Dashboard from './realtor/pages/Dashboard.jsx';
import SubmitLead from './referral/pages/SubmitLead.jsx';

export function RootLayout() {
  return (
    <GuestWorkspaceProvider>
      <AppNav />
      <LeaveGuard />
      <ChatAlerts />
      <Outlet />
    </GuestWorkspaceProvider>
  );
}

export const routes = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Marketing /> },
      { path: 'tools', element: <Home /> },
      { path: 'learn-more', element: <LearnMore /> },
      { path: 'collect', element: <Collect /> },
      { path: 'open-house', element: <OpenHouse /> },
      { path: 'workspace', element: <Workspace /> },
      { path: 'workspace/:tokenOrId', element: <SharedWorkspace /> },
      { path: 'w/:token', element: <SharedWorkspace /> },
      { path: 'compare', element: <Compare /> },
      { path: 'realtor', element: <RealtorHome /> },
      { path: 'realtor/create', element: <CreateWorkspace /> },
      { path: 'realtor/dashboard', element: <Dashboard /> },
      {
        path: 'referral',
        element: (
          <Page
            title="Referral"
            lede="Pass on a lead you cannot personally serve."
            links={referralLinks}
          />
        ),
      },
      { path: 'referral/submit', element: <SubmitLead /> },
      {
        path: '*',
        element: <Page title="Page not found" lede="This address is not part of Hapstr." />,
      },
    ],
  },
];
