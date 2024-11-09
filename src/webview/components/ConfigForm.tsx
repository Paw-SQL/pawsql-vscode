// ConfigForm.tsx
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
import ApiIcon from "@mui/icons-material/Api";
import PublicIcon from "@mui/icons-material/Public";
import LinkIcon from "@mui/icons-material/Link";
import PawIcon from "./PawIcon";
import { FormattedMessage, useIntl } from "react-intl";
import PawIconWithText from "./PawIconWithText";

interface Config {
  apiKey: string;
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
  const [formState, setFormState] = React.useState<Config>(initialConfig);
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState("");
  const [snackbarSeverity, setSnackbarSeverity] = React.useState<
    "success" | "error"
  >("success");
  const { formatMessage } = useIntl();

  // Update form state when initialConfig changes
  React.useEffect(() => {
    setFormState(initialConfig);
  }, [initialConfig]);

  const openExternalLink = (url: string) => {
    vscode.postMessage({ command: "openLink", url });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // if (!formState.apiKey || !formState.backendUrl || !formState.frontendUrl) {
    //   setSnackbarMessage("请填写所有字段");
    //   setSnackbarSeverity("error");
    //   setSnackbarOpen(true);
    //   return;
    // }

    onSubmit(formState);
    // setSnackbarMessage(formatMessage({ id: "webview.settings.save.config.success" }));
    // setSnackbarSeverity("success");
    // setSnackbarOpen(true);
  };

  const handleInputChange =
    (field: keyof Config) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  return (
    <Container maxWidth="sm" sx={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "20px",
          gap: "10px",
          textAlign: "center",
        }}
      >
        <PawIconWithText scale={0.5} />
        <Typography variant="body1" align="center" color="textSecondary">
          <span
            data-br=":r1:"
            data-brr="1"
            style={{
              display: "inline-block",
              verticalAlign: "top",
              textDecoration: "inherit",
            }}
          >
            <FormattedMessage id="form.config.description" />{" "}
            <a
              href="#"
              onClick={() => openExternalLink("https://docs.pawsql.com")}
              style={{ color: "#3f51b5", textDecoration: "underline" }}
            >
              <FormattedMessage id="form.config.documentation.link" />
            </a>
          </span>
        </Typography>
      </div>

      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label={formatMessage({ id: "sidebar.apiKey.label" })}
          variant="outlined"
          margin="normal"
          value={formState.apiKey}
          onChange={handleInputChange("apiKey")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <ApiIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          label={formatMessage({ id: "sidebar.backendUrl.label" })}
          variant="outlined"
          margin="normal"
          value={formState.backendUrl}
          onChange={handleInputChange("backendUrl")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PublicIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          label={formatMessage({ id: "sidebar.frontendUrl.label" })}
          variant="outlined"
          margin="normal"
          value={formState.frontendUrl}
          onChange={handleInputChange("frontendUrl")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LinkIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ marginTop: "16px" }}
        >
          <FormattedMessage id="form.config.save" />
        </Button>
      </form>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ConfigForm;
