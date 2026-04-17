import AppRoutes from "./routes/AppRoutes";
import SyncUser from "./components/SyncUser";

export default function App() {
    return (
        <>
            <SyncUser />
            <AppRoutes />
        </>
    );
}