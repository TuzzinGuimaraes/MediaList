const React = require('react');

const RouterContext = React.createContext(null);
const OutletContext = React.createContext(null);

function normalizeRoute(route) {
    if (!route) {
        return { pathname: '/', search: '' };
    }

    const [pathname, search = ''] = route.split('?');
    return {
        pathname: pathname || '/',
        search: search ? `?${search}` : '',
    };
}

function matchPath(routePath, pathname) {
    if (!routePath) {
        return { matched: true, params: {} };
    }

    if (routePath === '*') {
        return { matched: true, params: {} };
    }

    const routeParts = routePath.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);

    if (routeParts.length !== pathParts.length) {
        return { matched: false, params: {} };
    }

    const params = {};

    for (let index = 0; index < routeParts.length; index += 1) {
        const routePart = routeParts[index];
        const pathPart = pathParts[index];

        if (routePart.startsWith(':')) {
            params[routePart.slice(1)] = pathPart;
            continue;
        }

        if (routePart !== pathPart) {
            return { matched: false, params: {} };
        }
    }

    return { matched: true, params };
}

function renderMatchedRoute(routeElement, routerValue) {
    if (!React.isValidElement(routeElement)) {
        return null;
    }

    const { path, element, children } = routeElement.props;
    const match = matchPath(path, routerValue.location.pathname);
    const childArray = React.Children.toArray(children);

    if (!match.matched) {
        return null;
    }

    const childMatch = childArray
        .map((child) => renderMatchedRoute(child, {
            ...routerValue,
            params: { ...routerValue.params, ...match.params },
        }))
        .find(Boolean);

    if (element && childMatch) {
        return (
            <RouterContext.Provider value={{ ...routerValue, params: { ...routerValue.params, ...match.params } }}>
                <OutletContext.Provider value={childMatch}>
                    {element}
                </OutletContext.Provider>
            </RouterContext.Provider>
        );
    }

    if (!path && childArray.length > 0) {
        return childMatch;
    }

    if (element) {
        return (
            <RouterContext.Provider value={{ ...routerValue, params: { ...routerValue.params, ...match.params } }}>
                {element}
            </RouterContext.Provider>
        );
    }

    return childMatch;
}

function RouterProvider({ initialRoute, children }) {
    const [location, setLocation] = React.useState(normalizeRoute(initialRoute));
    const [params, setParams] = React.useState({});

    const navigate = React.useCallback((to) => {
        const nextRoute = normalizeRoute(typeof to === 'number' ? '/' : to);
        setLocation((current) => {
            if (
                current.pathname === nextRoute.pathname &&
                current.search === nextRoute.search
            ) {
                return current;
            }

            return nextRoute;
        });
    }, []);

    const setSearchParams = React.useCallback((value) => {
        const paramsValue = value instanceof URLSearchParams ? value.toString() : new URLSearchParams(value).toString();
        setLocation((current) => ({
            ...current,
            search: paramsValue ? `?${paramsValue}` : '',
        }));
    }, []);

    const value = React.useMemo(() => ({
        location,
        navigate,
        params,
        setParams,
        searchParams: new URLSearchParams(location.search),
        setSearchParams,
    }), [location, navigate, params, setSearchParams]);

    return (
        <RouterContext.Provider value={value}>
            {children}
        </RouterContext.Provider>
    );
}

function BrowserRouter({ children }) {
    const initialRoute = `${window.location.pathname || '/'}${window.location.search || ''}`;
    return <RouterProvider initialRoute={initialRoute}>{children}</RouterProvider>;
}

function MemoryRouter({ children, initialEntries = ['/'] }) {
    return <RouterProvider initialRoute={initialEntries[0]}>{children}</RouterProvider>;
}

function Routes({ children }) {
    const router = React.useContext(RouterContext);
    return React.Children.toArray(children)
        .map((child) => renderMatchedRoute(child, router))
        .find(Boolean);
}

function Route() {
    return null;
}

function Navigate({ to }) {
    const router = React.useContext(RouterContext);

    React.useEffect(() => {
        const nextRoute = normalizeRoute(to);

        if (
            router.location.pathname === nextRoute.pathname &&
            router.location.search === nextRoute.search
        ) {
            return;
        }

        router.navigate(to);
    }, [router, to]);

    return null;
}

function Outlet() {
    return React.useContext(OutletContext);
}

function NavLink({ to, className, children, end, onClick, ...rest }) {
    const router = React.useContext(RouterContext);
    const normalized = normalizeRoute(to);
    const isActive = end
        ? router.location.pathname === normalized.pathname
        : router.location.pathname.startsWith(normalized.pathname);
    const resolvedClassName = typeof className === 'function' ? className({ isActive }) : className;

    return (
        <a
            {...rest}
            href={to}
            className={resolvedClassName}
            onClick={(event) => {
                event.preventDefault();
                router.navigate(to);
                if (onClick) {
                    onClick(event);
                }
            }}
        >
            {children}
        </a>
    );
}

function useNavigate() {
    return React.useContext(RouterContext).navigate;
}

function useParams() {
    return React.useContext(RouterContext).params || {};
}

function useSearchParams() {
    const router = React.useContext(RouterContext);
    return [router.searchParams, router.setSearchParams];
}

module.exports = {
    BrowserRouter,
    MemoryRouter,
    Navigate,
    NavLink,
    Outlet,
    Route,
    Routes,
    useNavigate,
    useParams,
    useSearchParams,
};
