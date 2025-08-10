import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App } from './pages/App';
import { Home } from './pages/Home';
import { Bank } from './pages/Bank';
import { Log } from './pages/Log';
import { Prizes } from './pages/Prizes';
import { Motivation } from './pages/Motivation';
import { Account } from './pages/Account';
import { Setup } from './pages/Setup';
import './styles.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'bank', element: <Bank /> },
      { path: 'log', element: <Log /> },
      { path: 'prizes', element: <Prizes /> },
      { path: 'motivation', element: <Motivation /> },
      { path: 'account', element: <Account /> }
    ]
  },
  { path: '/setup', element: <Setup /> }
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);


