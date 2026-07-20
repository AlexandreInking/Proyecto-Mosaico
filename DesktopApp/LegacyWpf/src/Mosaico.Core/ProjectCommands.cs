namespace Mosaico.Core;

public readonly struct GridRectangle
{
    public GridRectangle(int x1, int y1, int x2, int y2)
    {
        Left = Math.Min(x1, x2);
        Top = Math.Min(y1, y2);
        Right = Math.Max(x1, x2);
        Bottom = Math.Max(y1, y2);
    }

    public int Left { get; }
    public int Top { get; }
    public int Right { get; }
    public int Bottom { get; }
    public long CellCount => (long)(Right - Left + 1) * (Bottom - Top + 1);
    public bool Contains(GridCoordinate coordinate)
        => coordinate.X >= Left && coordinate.X <= Right && coordinate.Y >= Top && coordinate.Y <= Bottom;
}

public interface IProjectCommand
{
    bool Execute(MapProject project);
    void Undo(MapProject project);
}

public sealed class ProjectCommandHistory(MapProject project)
{
    private readonly Stack<IProjectCommand> _undo = [];
    private readonly Stack<IProjectCommand> _redo = [];

    public bool CanUndo => _undo.Count > 0;
    public bool CanRedo => _redo.Count > 0;

    public bool Execute(IProjectCommand command)
    {
        ArgumentNullException.ThrowIfNull(command);
        if (!command.Execute(project)) return false;
        _undo.Push(command);
        _redo.Clear();
        return true;
    }

    public bool Undo()
    {
        if (!_undo.TryPop(out var command)) return false;
        command.Undo(project);
        _redo.Push(command);
        return true;
    }

    public bool Redo()
    {
        if (!_redo.TryPop(out var command)) return false;
        if (!command.Execute(project)) throw new InvalidOperationException("A previously effective command became ineffective during redo.");
        _undo.Push(command);
        return true;
    }
}

public sealed class PaintTilesCommand(Guid layerId, IEnumerable<GridCoordinate> coordinates, TileRef? tile) : IProjectCommand
{
    private readonly GridCoordinate[] _coordinates = coordinates.Distinct().ToArray();
    private Dictionary<GridCoordinate, TileRef?>? _previous;

    public bool Execute(MapProject project)
    {
        if (_coordinates.Length > MapProject.MaximumOccupiedCells)
            throw new InvalidOperationException("RESOURCE_LIMIT_EDIT_CELLS");
        if (_coordinates.Any(coordinate => coordinate.X < 0 || coordinate.X >= project.Width
            || coordinate.Y < 0 || coordinate.Y >= project.Height))
            throw new ArgumentOutOfRangeException(nameof(coordinates), "Edit contains a coordinate outside map bounds.");
        if (tile is not null)
        {
            var additions = _coordinates.Count(coordinate => project.GetTile(layerId, coordinate) is null);
            MapProject.ValidateOccupiedCellBudget(project.OccupiedCellCount, additions);
        }
        _previous ??= _coordinates.ToDictionary(coordinate => coordinate, coordinate => project.GetTile(layerId, coordinate));
        var changed = false;
        foreach (var coordinate in _coordinates)
        {
            if (project.GetTile(layerId, coordinate) == tile) continue;
            project.SetTile(layerId, coordinate, tile);
            changed = true;
        }
        return changed;
    }

    public void Undo(MapProject project)
    {
        if (_previous is null) throw new InvalidOperationException("Command has not executed.");
        foreach (var (coordinate, previous) in _previous) project.SetTile(layerId, coordinate, previous);
    }
}

public sealed class ClearSelectionCommand(Guid layerId, GridRectangle selection) : IProjectCommand
{
    private PaintTilesCommand? _edit;

    public bool Execute(MapProject project)
    {
        if (selection.CellCount > MapProject.MaximumOccupiedCells)
            throw new InvalidOperationException("RESOURCE_LIMIT_SELECTION_CELLS");
        _edit ??= new PaintTilesCommand(layerId, EnumerateOccupied(project), null);
        return _edit.Execute(project);
    }

    public void Undo(MapProject project)
        => (_edit ?? throw new InvalidOperationException("Command has not executed.")).Undo(project);

    private IEnumerable<GridCoordinate> EnumerateOccupied(MapProject project)
    {
        var layer = project.Layers.Single(item => item.Id == layerId);
        return layer.Cells().Select(cell => cell.Coordinate).Where(selection.Contains).ToArray();
    }
}

public sealed class FloodFillCommand(
    Guid layerId,
    GridCoordinate seed,
    TileRef? replacement,
    GridRectangle? selection = null) : IProjectCommand
{
    private PaintTilesCommand? _edit;

    public bool Execute(MapProject project)
    {
        if (selection is { CellCount: > MapProject.MaximumOccupiedCells })
            throw new InvalidOperationException("RESOURCE_LIMIT_SELECTION_CELLS");
        if (seed.X < 0 || seed.X >= project.Width || seed.Y < 0 || seed.Y >= project.Height)
            throw new ArgumentOutOfRangeException(nameof(seed));
        if (selection is { } bounds && !bounds.Contains(seed)) return false;
        var target = project.GetTile(layerId, seed);
        if (target == replacement) return false;
        _edit ??= new PaintTilesCommand(layerId, FindRegion(project, target), replacement);
        return _edit.Execute(project);
    }

    public void Undo(MapProject project)
        => (_edit ?? throw new InvalidOperationException("Command has not executed.")).Undo(project);

    private IReadOnlyList<GridCoordinate> FindRegion(MapProject project, TileRef? target)
    {
        var found = new List<GridCoordinate>();
        var pending = new Queue<GridCoordinate>();
        var visited = new HashSet<GridCoordinate>();
        pending.Enqueue(seed);
        while (pending.TryDequeue(out var coordinate))
        {
            if (!visited.Add(coordinate) || coordinate.X < 0 || coordinate.X >= project.Width
                || coordinate.Y < 0 || coordinate.Y >= project.Height
                || selection is { } bounds && !bounds.Contains(coordinate)
                || project.GetTile(layerId, coordinate) != target)
                continue;
            found.Add(coordinate);
            if (found.Count > MapProject.MaximumOccupiedCells)
                throw new InvalidOperationException("RESOURCE_LIMIT_FILL_CELLS");
            pending.Enqueue(new(coordinate.X - 1, coordinate.Y));
            pending.Enqueue(new(coordinate.X + 1, coordinate.Y));
            pending.Enqueue(new(coordinate.X, coordinate.Y - 1));
            pending.Enqueue(new(coordinate.X, coordinate.Y + 1));
        }
        return found;
    }
}

public sealed class AddLayerCommand(string name, Guid id) : IProjectCommand
{
    private Guid? _previousActive;

    public bool Execute(MapProject project)
    {
        _previousActive ??= project.ActiveLayerId;
        project.AddLayer(name, id);
        return true;
    }

    public void Undo(MapProject project)
    {
        project.RemoveLayer(id);
        project.SetActiveLayer(_previousActive ?? throw new InvalidOperationException("Command has not executed."));
    }
}

public sealed class RemoveLayerCommand(Guid layerId) : IProjectCommand
{
    private TileLayer? _removed;
    private int? _index;
    private Guid? _previousActive;

    public bool Execute(MapProject project)
    {
        _removed ??= project.Layers.Single(item => item.Id == layerId);
        _index ??= project.IndexOfLayer(layerId);
        _previousActive ??= project.ActiveLayerId;
        project.RemoveLayer(layerId);
        return true;
    }

    public void Undo(MapProject project)
    {
        project.RestoreLayer(_removed ?? throw new InvalidOperationException("Command has not executed."),
            _index ?? throw new InvalidOperationException("Command has not executed."));
        project.SetActiveLayer(_previousActive ?? throw new InvalidOperationException("Command has not executed."));
    }
}

public sealed class RemoveTilesetCommand(Guid tilesetId) : IProjectCommand
{
    private TilesetDefinition? _removed;
    private int? _index;

    public bool Execute(MapProject project)
    {
        _removed ??= project.Tilesets.Single(item => item.Id == tilesetId);
        _index ??= project.Tilesets.ToList().FindIndex(item => item.Id == tilesetId);
        project.RemoveTileset(tilesetId);
        return true;
    }

    public void Undo(MapProject project)
        => project.RestoreTileset(_removed ?? throw new InvalidOperationException("Command has not executed."),
            _index ?? throw new InvalidOperationException("Command has not executed."));
}

public sealed class RenameLayerCommand(Guid layerId, string name) : IProjectCommand
{
    private string? _previous;

    public bool Execute(MapProject project)
    {
        var layer = project.Layers.Single(item => item.Id == layerId);
        _previous ??= layer.Name;
        if (layer.Name == name.Trim()) return false;
        project.RenameLayer(layerId, name);
        return true;
    }

    public void Undo(MapProject project) => project.RenameLayer(layerId, _previous ?? throw new InvalidOperationException("Command has not executed."));
}

public sealed class MoveLayerCommand(Guid layerId, int newIndex) : IProjectCommand
{
    private int? _previousIndex;

    public bool Execute(MapProject project)
    {
        _previousIndex ??= project.IndexOfLayer(layerId);
        if (project.IndexOfLayer(layerId) == newIndex) return false;
        project.MoveLayer(layerId, newIndex);
        return true;
    }

    public void Undo(MapProject project) => project.MoveLayer(layerId, _previousIndex ?? throw new InvalidOperationException("Command has not executed."));
}

public sealed class SetLayerVisibilityCommand(Guid layerId, bool isVisible) : IProjectCommand
{
    private bool? _previous;

    public bool Execute(MapProject project)
    {
        var layer = project.Layers.Single(item => item.Id == layerId);
        _previous ??= layer.IsVisible;
        if (layer.IsVisible == isVisible) return false;
        project.SetLayerVisibility(layerId, isVisible);
        return true;
    }

    public void Undo(MapProject project) => project.SetLayerVisibility(layerId, _previous ?? throw new InvalidOperationException("Command has not executed."));
}

public sealed class SetLayerLockedCommand(Guid layerId, bool isLocked) : IProjectCommand
{
    private bool? _previous;

    public bool Execute(MapProject project)
    {
        var layer = project.Layers.Single(item => item.Id == layerId);
        _previous ??= layer.IsLocked;
        if (layer.IsLocked == isLocked) return false;
        project.SetLayerLocked(layerId, isLocked);
        return true;
    }

    public void Undo(MapProject project) => project.SetLayerLocked(layerId, _previous ?? throw new InvalidOperationException("Command has not executed."));
}

public sealed class ChangeCellSizeCommand(int cellWidth, int cellHeight) : IProjectCommand
{
    private (int Width, int Height)? _previous;

    public bool Execute(MapProject project)
    {
        _previous ??= (project.CellWidth, project.CellHeight);
        if ((project.CellWidth, project.CellHeight) == (cellWidth, cellHeight)) return false;
        project.SetCellSize(cellWidth, cellHeight);
        return true;
    }

    public void Undo(MapProject project)
    {
        var previous = _previous ?? throw new InvalidOperationException("Command has not executed.");
        project.SetCellSize(previous.Width, previous.Height);
    }
}

public sealed class SetActiveLayerCommand(Guid layerId) : IProjectCommand
{
    private Guid? _previous;

    public bool Execute(MapProject project)
    {
        _previous ??= project.ActiveLayerId;
        if (project.ActiveLayerId == layerId) return false;
        project.SetActiveLayer(layerId);
        return true;
    }

    public void Undo(MapProject project)
        => project.SetActiveLayer(_previous ?? throw new InvalidOperationException("Command has not executed."));
}
