import React, { useState, useEffect } from "react";
import ModelCard from "./components/ModelCard.js";
import AddModelModal from "./AddModelModal.js";

const DEFAULT_MODELS = [
 ];

function ModelPanel({ onModelSelect, selectedModel: externalModel }) {
  const [models, setModels]         = useState(DEFAULT_MODELS);
  const [modalOpen, setModalOpen]   = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // When a model is injected from outside (e.g. navigated from Jobs page),
  // add it to the list if absent and mark it as selected.
  useEffect(() => {
    if (!externalModel) return;
    setModels(prev => {
      const exists = prev.find(m => String(m.id) === String(externalModel.id));
      return exists ? prev : [...prev, { ...externalModel, tag: externalModel.type, tagColor: externalModel.typeColor }];
    });
    setSelectedId(externalModel.id);
    onModelSelect?.(externalModel);
  }, [externalModel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select the first model whenever the list changes and nothing is selected
  useEffect(() => {
    if (models.length > 0 && (selectedId === null || !models.find(m => m.id === selectedId))) {
      const first = models[0];
      setSelectedId(first.id);
      onModelSelect?.(first);
    }
  }, [models]); // eslint-disable-line react-hooks/exhaustive-deps

  const addedIds = new Set(models.map(m => m.id));

  const handleAdd = (catalogueModel) => {
    setModels(prev => [
      ...prev,
      {
        ...catalogueModel,
        tag:      catalogueModel.type,
        tagColor: catalogueModel.typeColor,
      },
    ]);
  };

  const handleRemove = (id) => {
    setModels(prev => prev.filter(m => m.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      onModelSelect?.(null);
    }
  };

  const handleSelect = (model) => {
    const newId = selectedId === model.id ? null : model.id;
    setSelectedId(newId);
    onModelSelect?.(newId ? model : null);
  };

  return (
    <>
      <div className="bg-[#161616] rounded-[15px] p-[18px] box-border flex flex-col gap-4 shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="bg-[rgba(6,148,251,0.17)] rounded-full px-3 py-1.5 whitespace-nowrap">
            <p className="text-[#0694FB] text-[12px] font-medium m-0">Inference Models</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-[#0694FB] hover:bg-[#0578d1] text-white text-[12px] font-medium px-3 py-[8px] rounded-full border-none cursor-pointer transition-colors whitespace-nowrap"
          >
            + Add Inference Model
          </button>
        </div>

        {/* Model list */}
        <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "220px", scrollbarWidth: "thin", scrollbarColor: "#1B1B1B #000" }}>
          {models.length === 0 ? (
            <p className="text-[#868686] text-[11px] text-center py-4 m-0">No inference models added</p>
          ) : (
              models.map(m => (
              
              <ModelCard
                key={m.id}
                model={m}
                selected={selectedId === m.id}
                onSelect={() => handleSelect(m)}
                onRemove={() => handleRemove(m.id)}
              />
            ))
          )}
        </div>
      </div>

      <AddModelModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        addedIds={addedIds}
        onAdd={handleAdd}
        onRemove={handleRemove}
      />
    </>
  );
}

export default ModelPanel;
