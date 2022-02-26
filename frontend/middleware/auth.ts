import { Context } from '@nuxt/types';
import { authStore } from '~/store';

/**
 * Functions handling all the auth logic and shared between Pinia watchers and auth plugin
 */

const serverAddUrl = '/server/add';
const serverSelectUrl = '/server/select';
const serverLoginUrl = '/server/login';
const loginRoutes = [serverAddUrl, serverSelectUrl, serverLoginUrl];

/**
 * This function acts as a middleware when auth is not completed or an user attempts to access auth
 * pages while logged in.
 *
 * @param context - The Nuxt context
 * @param auth - The Pinia's authStore instance
 * @param useContext - Before the app is booted, we must use context.redirect method so the redirection happens as soon
 * as possible in Nuxt's initialization cycle. However, after the app is already running, it's suggested
 * to use the Vue Router push method, so there are no conflicts. This variable selects
 * which redirection method to use
 */
function handleAuthRedirections(
  context: Context,
  auth: ReturnType<typeof authStore>,
  useContext: boolean
) {
  const servers = auth.servers || [];
  const userToken = auth.getUserAccessToken(auth.getCurrentUser) || '';
  const currentRoute = context.app.router?.currentRoute?.fullPath || '';
  // @ts-expect-error - No types for this. TODO: Investigate why
  const nextRoute = context.app.router?.history?.pending?.fullPath || '';
  let destinationRoute = '';

  const currentBaseUrl = context.$axios.defaults.baseURL;

  if (!servers.length) {
    destinationRoute = serverAddUrl;
  } else if (
    (currentBaseUrl && !userToken) ||
    (currentRoute === serverAddUrl && servers.length === 1)
  ) {
    destinationRoute = serverLoginUrl;
  } else if (
    currentBaseUrl &&
    userToken &&
    loginRoutes.includes(currentRoute)
  ) {
    destinationRoute = '/';
  } else if (!currentBaseUrl) {
    destinationRoute = serverSelectUrl;
  }

  /**
   * We verify that Vue router is not already performing a redirection to any of the server pages to avoid
   * performing a new redirection while another one is in progress (which halts the client completely)
   * and to allow the server pages to manipulate the login flow as they wish using $router.push, without the store
   * intervining when it's not necessary.
   */
  if (
    destinationRoute &&
    currentRoute !== destinationRoute &&
    nextRoute !== destinationRoute
  ) {
    if (useContext) {
      context.redirect(destinationRoute);
    } else {
      context.app.router?.push(destinationRoute);
    }
  }
}

/**
 * Set the header and base url to communicate with the server
 *
 * @param ctx - The Nuxt context
 * @param auth - The Pinia's authStore instance
 */
export function setHeaderAndBaseUrl(
  ctx: Context,
  auth: ReturnType<typeof authStore>
) {
  const currentServer = auth.getCurrentServer?.Address || '';

  ctx.$axios.setBaseURL(currentServer);
  auth.setAxiosHeader();
}

/**
 * Runs all the logic to keep the communication with the server and acts as a middleware for login
 * when necessary.
 *
 * @param ctx - The Nuxt context
 * @param auth - The Pinia's authStore instance
 * @param useContext - Before the app is booted, we must use context.redirect method so the redirection happens as soon
 * as possible in Nuxt's initialization cycle. However, after the app is already running, it's suggested
 * to use the Vue Router push method, so there are no conflicts. This variable selects
 * which redirection method to use
 */
export function authLogic(
  ctx: Context,
  auth: ReturnType<typeof authStore>,
  useContext: boolean
) {
  setHeaderAndBaseUrl(ctx, auth);
  handleAuthRedirections(ctx, auth, useContext);
}

/**
 * The first time this middleware takes place, we must use context.redirect to force the redirection to the right place properly
 * However, after the app is already running, Vue router should be used instead. This single use boolean helps us distinguish between both
 */
let appBooting = true;

export default function (context: Context): void {
  const auth = authStore();

  authLogic(context, auth, appBooting);

  if (appBooting) {
    appBooting = false;
  }
}
