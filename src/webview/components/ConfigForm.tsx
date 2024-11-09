import React from "react";
import {
  TextField,
  Button,
  Typography,
  Container,
  Snackbar,
  Alert,
  InputAdornment,
} from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";
import LinkIcon from "@mui/icons-material/Link";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import { FormattedMessage, useIntl } from "react-intl";
import PawIconWithText from "./PawIconWithText";

interface Config {
  email: string;
  password: string;
  backendUrl: string;
  frontendUrl: string;
}

interface ConfigFormProps {
  vscode: {
    postMessage: (message: any) => void;
    getState: () => any;
  };
  initialConfig: Config;
  onSubmit: (config: Config) => void;
}

const ConfigForm: React.FC<ConfigFormProps> = ({
  vscode,
  initialConfig,
  onSubmit,
}) => {
  const defaultConfig = {
    ...initialConfig,
  };

  const [formState, setFormState] = React.useState<Config>(defaultConfig);
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState("");
  const [snackbarSeverity, setSnackbarSeverity] = React.useState<
    "success" | "error"
  >("success");
  const { formatMessage } = useIntl();

  React.useEffect(() => {
    setFormState(defaultConfig);
  }, [initialConfig]);

  const openExternalLink = (url: string) => {
    vscode.postMessage({ command: "openLink", url });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formState.email || !formState.password) {
      setSnackbarMessage(
        formatMessage({ id: "form.config.validation.credentials.required" })
      );
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    if (!formState.backendUrl || !formState.frontendUrl) {
      setSnackbarMessage(
        formatMessage({ id: "form.config.validation.urls.required" })
      );
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    onSubmit(formState);
    setSnackbarMessage(
      formatMessage({ id: "webview.settings.save.config.success" })
    );
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        padding: "20px",
        "& .MuiTextField-root": {
          backgroundColor: "#ffffff",
          borderRadius: "4px",
          "& .MuiOutlinedInput-root": {
            "&:hover fieldset": {
              borderColor: "#007acc",
            },
          },
        },
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "24px",
          gap: "12px",
          textAlign: "center",
        }}
      >
        <PawIconWithText scale={0.5} />
        <Typography
          variant="body1"
          align="center"
          color="textSecondary"
          sx={{ maxWidth: "460px" }}
        >
          <FormattedMessage id="form.config.description" />{" "}
          <a
            href="#"
            onClick={() => openExternalLink("https://docs.pawsql.com")}
            style={{
              color: "#007acc",
              textDecoration: "underline",
            }}
          >
            <FormattedMessage id="form.config.documentation.link" />
          </a>
        </Typography>
      </div>

      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          name="email"
          label={formatMessage({ id: "form.config.email.label" })}
          variant="outlined"
          margin="normal"
          value={formState.email}
          onChange={handleInputChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon sx={{ color: "#666" }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          name="password"
          type="password"
          label={formatMessage({ id: "form.config.password.label" })}
          variant="outlined"
          margin="normal"
          value={formState.password}
          onChange={handleInputChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon sx={{ color: "#666" }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          name="backendUrl"
          label={formatMessage({ id: "form.config.backendUrl.label" })}
          variant="outlined"
          margin="normal"
          value={formState.backendUrl}
          onChange={handleInputChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PublicIcon sx={{ color: "#666" }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          name="frontendUrl"
          label={formatMessage({ id: "form.config.frontendUrl.label" })}
          variant="outlined"
          margin="normal"
          value={formState.frontendUrl}
          onChange={handleInputChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LinkIcon sx={{ color: "#666" }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{
            height: "48px",
            fontSize: "16px",
            backgroundColor: "#007acc",
            color: "#ffffff",
            textTransform: "none",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            "&:hover": {
              backgroundColor: "#005999",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
            },
            transition: "all 0.3s ease",
          }}
        >
          <FormattedMessage id="form.config.save" />
        </Button>
      </form>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{
            width: "100%",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ConfigForm;
